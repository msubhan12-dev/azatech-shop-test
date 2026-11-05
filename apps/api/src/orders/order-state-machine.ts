import { OrderStatus } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

/**
 * Order State Machine
 * Manages valid transitions between order statuses.
 * This is the single source of truth for allowed transitions.
 */

export type OrderTransition = {
  from: OrderStatus[];
  to: OrderStatus;
  allowedRoles: string[];
};

export const ORDER_TRANSITIONS: OrderTransition[] = [
  {
    from: [OrderStatus.PENDING],
    to: OrderStatus.PAID,
    allowedRoles: ['admin', 'cashier'],
  },
  {
    from: [OrderStatus.PAID],
    to: OrderStatus.SHIPPED,
    allowedRoles: ['admin'],
  },
  {
    from: [OrderStatus.SHIPPED],
    to: OrderStatus.COMPLETED,
    allowedRoles: ['admin'],
  },
  {
    from: [OrderStatus.PENDING, OrderStatus.PAID],
    to: OrderStatus.CANCELLED,
    allowedRoles: ['admin'],
  },
];

export class OrderStateMachine {
  /**
   * Check if transition is valid regardless of role
   */
  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return ORDER_TRANSITIONS.some(
      (t) => t.to === to && t.from.includes(from),
    );
  }

  /**
   * Check if transition is valid for the given role
   */
  static canTransitionWithRole(
    from: OrderStatus,
    to: OrderStatus,
    role: string,
  ): boolean {
    return ORDER_TRANSITIONS.some(
      (t) =>
        t.to === to &&
        t.from.includes(from) &&
        t.allowedRoles.includes(role),
    );
  }

  /**
   * Assert transition is valid, throw ConflictException if not
   */
  static assertTransition(
    from: OrderStatus,
    to: OrderStatus,
    role: string,
    orderNumber: string,
  ): void {
    if (!this.canTransition(from, to)) {
      throw new ConflictException(
        `Tidak dapat mengubah status order ${orderNumber} dari ${from} ke ${to}`,
      );
    }

    if (!this.canTransitionWithRole(from, to, role)) {
      throw new ConflictException(
        `Role ${role} tidak diizinkan untuk mengubah status dari ${from} ke ${to}`,
      );
    }
  }

  /**
   * Get all allowed next states from current state
   */
  static getAllowedTransitions(from: OrderStatus): OrderStatus[] {
    return ORDER_TRANSITIONS
      .filter((t) => t.from.includes(from))
      .map((t) => t.to);
  }
}

import { describe, it, expect } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { OrderStateMachine } from '../order-state-machine';
import { ConflictException } from '@nestjs/common';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    it('allows PENDING → PAID', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    });

    it('allows PAID → SHIPPED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(true);
    });

    it('allows SHIPPED → COMPLETED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.SHIPPED, OrderStatus.COMPLETED)).toBe(true);
    });

    it('allows PENDING → CANCELLED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    });

    it('allows PAID → CANCELLED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
    });

    it('rejects SHIPPED → CANCELLED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects COMPLETED → CANCELLED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects CANCELLED → any status', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
      expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
    });

    it('rejects COMPLETED → SHIPPED', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.SHIPPED)).toBe(false);
    });

    it('rejects PENDING → SHIPPED directly', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
    });

    it('rejects PENDING → COMPLETED directly', () => {
      expect(OrderStateMachine.canTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toBe(false);
    });
  });

  describe('canTransitionWithRole', () => {
    it('allows cashier to mark PAID', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PENDING, OrderStatus.PAID, 'cashier')).toBe(true);
    });

    it('allows admin to mark PAID', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PENDING, OrderStatus.PAID, 'admin')).toBe(true);
    });

    it('rejects cashier from marking SHIPPED', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PAID, OrderStatus.SHIPPED, 'cashier')).toBe(false);
    });

    it('allows admin to mark SHIPPED', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PAID, OrderStatus.SHIPPED, 'admin')).toBe(true);
    });

    it('rejects cashier from cancelling', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PENDING, OrderStatus.CANCELLED, 'cashier')).toBe(false);
    });

    it('allows admin to cancel PENDING', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PENDING, OrderStatus.CANCELLED, 'admin')).toBe(true);
    });

    it('allows admin to cancel PAID', () => {
      expect(OrderStateMachine.canTransitionWithRole(OrderStatus.PAID, OrderStatus.CANCELLED, 'admin')).toBe(true);
    });
  });

  describe('assertTransition', () => {
    it('throws ConflictException for invalid transition', () => {
      expect(() =>
        OrderStateMachine.assertTransition(
          OrderStatus.SHIPPED,
          OrderStatus.CANCELLED,
          'admin',
          'INV-001',
        ),
      ).toThrowError(ConflictException);
    });

    it('throws ConflictException for invalid role', () => {
      expect(() =>
        OrderStateMachine.assertTransition(
          OrderStatus.PAID,
          OrderStatus.SHIPPED,
          'cashier',
          'INV-001',
        ),
      ).toThrowError(ConflictException);
    });

    it('does not throw for valid transition and role', () => {
      expect(() =>
        OrderStateMachine.assertTransition(
          OrderStatus.PENDING,
          OrderStatus.PAID,
          'cashier',
          'INV-001',
        ),
      ).not.toThrow();
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns correct transitions for PENDING', () => {
      const transitions = OrderStateMachine.getAllowedTransitions(OrderStatus.PENDING);
      expect(transitions).toContain(OrderStatus.PAID);
      expect(transitions).toContain(OrderStatus.CANCELLED);
      expect(transitions).not.toContain(OrderStatus.SHIPPED);
    });

    it('returns empty array for COMPLETED', () => {
      const transitions = OrderStateMachine.getAllowedTransitions(OrderStatus.COMPLETED);
      expect(transitions).toHaveLength(0);
    });

    it('returns empty array for CANCELLED', () => {
      const transitions = OrderStateMachine.getAllowedTransitions(OrderStatus.CANCELLED);
      expect(transitions).toHaveLength(0);
    });
  });
});

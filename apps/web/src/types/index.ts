export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  stock: number;
  price: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Customer {
  id: string;
  customerName: string;
  customerAddress: string;
  gender: 'Pria' | 'Wanita';
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: {
    id: string;
    productCode: string;
    productName: string;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  createdBy: string;
  status: OrderStatus;
  totalAmount: number;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    customerName: string;
  };
  creator?: {
    id: string;
    name: string;
  };
  items?: OrderItem[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'INITIAL' | 'ORDER_OUT' | 'CANCEL_RESTORE' | 'ADJUSTMENT';
  quantityChange: number;
  stockAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  creator: { id: string; name: string; email: string } | null;
}

export interface SalesReportItem {
  period: string;
  totalOrders: number;
  totalRevenue: number;
}

export interface TopProduct {
  productId: string;
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface DashboardSummary {
  orders: {
    total: number;
    pending: number;
    paid: number;
    shipped: number;
    completed: number;
    cancelled: number;
  };
  revenue: { total: number };
  products: { total: number; lowStock: number };
  customers: { total: number };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    customerName: string;
    orderDate: string;
  }>;
}

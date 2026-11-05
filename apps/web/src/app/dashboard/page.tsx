'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DashboardSummary } from '@/types';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardSummary }>('/dashboard/summary');
      return res.data.data;
    },
  });

  if (isLoading) return <div className="text-gray-500">Memuat dashboard...</div>;
  if (isError) return <div className="text-red-600">Gagal memuat data.</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Total Order</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.orders.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Total Omzet</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.revenue.total)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Total Produk</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.products.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Stok Rendah</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{data.products.lowStock}</p>
        </div>
      </div>

      {/* Order status breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Order</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['pending', 'paid', 'shipped', 'completed', 'cancelled'] as const).map((s) => (
            <div key={s} className="text-center">
              <p className="text-xl font-bold text-gray-900">{data.orders[s]}</p>
              <p className="text-sm text-gray-500 capitalize">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Terbaru</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">No. Order</th>
                <th className="pb-2 font-medium">Pelanggan</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">Belum ada order</td>
                </tr>
              ) : (
                data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/dashboard/orders/${order.id}`} className="text-primary-600 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2">{order.customerName}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-2 text-gray-500">{new Date(order.orderDate).toLocaleDateString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-blue-100 text-blue-700',
    SHIPPED: 'bg-purple-100 text-purple-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-700';
}

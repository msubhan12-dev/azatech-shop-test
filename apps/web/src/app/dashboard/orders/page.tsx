'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Order, PaginatedResponse } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const page = Number(searchParams.get('page') ?? 1);
  const perPage = Number(searchParams.get('perPage') ?? 10);
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, perPage, status, from, to }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api.get<PaginatedResponse<Order>>(`/orders?${params}`);
      return res.data;
    },
  });

  function updateQuery(params: Record<string, string | number>) {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) newParams.set(key, String(value));
      else newParams.delete(key);
    });
    router.push(`${pathname}?${newParams.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Order</h1>
        <Link href="/dashboard/orders/create" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium">
          Buat Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="f-status" className="block text-xs text-gray-500 mb-1">Status</label>
          <select id="f-status" value={status} onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">Semua</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className="block text-xs text-gray-500 mb-1">Dari</label>
          <input id="f-from" type="date" value={from} onChange={(e) => updateQuery({ from: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="f-to" className="block text-xs text-gray-500 mb-1">Sampai</label>
          <input id="f-to" type="date" value={to} onChange={(e) => updateQuery({ to: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>

      {isLoading && <div className="text-gray-500">Memuat...</div>}

      {data && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">No. Order</th>
                  <th className="px-4 py-3 font-medium">Pelanggan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada order</td></tr>
                ) : (
                  data.data.map((order) => (
                    <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/orders/${order.id}`} className="text-primary-600 hover:underline font-medium">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{order.customer?.customerName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(order.orderDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total: {data.meta.total} order</p>
            <div className="flex gap-2">
              <button onClick={() => updateQuery({ page: page - 1 })} disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">Sebelumnya</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {data.meta.total_pages}</span>
              <button onClick={() => updateQuery({ page: page + 1 })} disabled={page >= data.meta.total_pages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">Selanjutnya</button>
            </div>
          </div>
        </>
      )}
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

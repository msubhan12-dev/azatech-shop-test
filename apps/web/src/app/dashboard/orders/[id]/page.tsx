'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { Order, ApiResponse } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${id}`);
      return res.data.data;
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (action: 'pay' | 'ship' | 'complete') => {
      await api.post(`/orders/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Status order berhasil diperbarui');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Gagal';
      toast.error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/orders/${id}/cancel`, { cancelReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Order berhasil dibatalkan');
      setShowCancelForm(false);
      setCancelReason('');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Gagal';
      toast.error(msg);
    },
  });

  if (isLoading) return <div className="text-gray-500">Memuat...</div>;
  if (!order) return <div className="text-red-600">Order tidak ditemukan</div>;

  // Determine which actions are available
  const canPay = order.status === 'PENDING';
  const canShip = order.status === 'PAID' && isAdmin;
  const canComplete = order.status === 'SHIPPED' && isAdmin;
  const canCancel = (order.status === 'PENDING' || order.status === 'PAID') && isAdmin;

  // Timeline data
  const timeline = [
    { label: 'Dibuat', date: order.orderDate, done: true },
    { label: 'Dibayar', date: order.paidAt, done: !!order.paidAt },
    { label: 'Dikirim', date: order.shippedAt, done: !!order.shippedAt },
    { label: 'Selesai', date: order.completedAt, done: !!order.completedAt },
  ];
  if (order.status === 'CANCELLED') {
    timeline.push({ label: 'Dibatalkan', date: order.cancelledAt, done: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/orders" className="text-sm text-gray-500 hover:underline">← Kembali ke Order</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <span className={`px-3 py-1 text-sm font-medium rounded ${statusColor(order.status)}`}>
            {order.status}
          </span>
        </div>
      </div>

      {/* Order info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">Informasi Order</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Pelanggan</dt>
              <dd className="font-medium">{order.customer?.customerName ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Dibuat oleh</dt>
              <dd className="font-medium">{order.creator?.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Tanggal</dt>
              <dd>{formatDateTime(order.orderDate)}</dd>
            </div>
            {order.cancelReason && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Alasan Batal</dt>
                <dd className="text-red-600">{order.cancelReason}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">Timeline Status</h2>
          <div className="space-y-3">
            {timeline.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${step.done ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${step.done ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {step.date && (
                  <span className="text-xs text-gray-500 ml-auto">{formatDateTime(step.date)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-3">Detail Item</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 font-medium">Kode</th>
              <th className="pb-2 font-medium">Produk</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium text-right">Harga</th>
              <th className="pb-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 font-mono text-xs">{item.product?.productCode ?? '-'}</td>
                <td className="py-2">{item.product?.productName ?? '-'}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-2 text-right font-medium">Total</td>
              <td className="pt-2 text-right text-lg font-bold text-gray-900">{formatCurrency(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {canPay && (
          <button
            onClick={() => transitionMutation.mutate('pay')}
            disabled={transitionMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            Tandai Dibayar
          </button>
        )}
        {canShip && (
          <button
            onClick={() => transitionMutation.mutate('ship')}
            disabled={transitionMutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            Tandai Dikirim
          </button>
        )}
        {canComplete && (
          <button
            onClick={() => transitionMutation.mutate('complete')}
            disabled={transitionMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            Tandai Selesai
          </button>
        )}
        {canCancel && !showCancelForm && (
          <button
            onClick={() => setShowCancelForm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
          >
            Batalkan Order
          </button>
        )}
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/orders/${id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium text-gray-700"
        >
          Unduh Invoice
        </a>
      </div>

      {/* Cancel form */}
      {showCancelForm && (
        <div className="bg-white rounded-lg shadow-sm p-5 border border-red-200 space-y-3">
          <h2 className="font-semibold text-red-900">Batalkan Order</h2>
          <div>
            <label htmlFor="cancel-reason" className="block text-sm text-gray-600 mb-1">Alasan Pembatalan (wajib)</label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="contoh: Customer membatalkan pesanan"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={!cancelReason || cancelReason.length < 5 || cancelMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {cancelMutation.isPending ? 'Memproses...' : 'Konfirmasi Batalkan'}
            </button>
            <button
              onClick={() => setShowCancelForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
            >
              Batal
            </button>
          </div>
        </div>
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

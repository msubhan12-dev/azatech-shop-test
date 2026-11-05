'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { Product, ApiResponse, StockMovement, PaginatedResponse } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product>>(`/products/${id}`);
      return res.data.data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', id],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<StockMovement>>(`/products/${id}/stock-movements`);
      return res.data;
    },
    enabled: isAdmin,
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/products/${id}/stock-adjustments`, {
        quantityChange: Number(adjQty),
        note: adjNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setAdjQty('');
      setAdjNote('');
      toast.success('Stok berhasil disesuaikan');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Gagal';
      toast.error(msg);
    },
  });

  if (!product) return <div className="text-gray-500">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-gray-500 hover:underline">
          ← Kembali ke Produk
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{product.productName}</h1>
        <p className="text-gray-500 font-mono text-sm">{product.productCode}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">Detail Produk</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Stok</dt>
              <dd className={`font-medium ${product.stock <= product.lowStockThreshold ? 'text-orange-600' : ''}`}>
                {product.stock} unit
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Harga</dt>
              <dd className="font-medium">{formatCurrency(product.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Batas Stok Min.</dt>
              <dd className="font-medium">{product.lowStockThreshold} unit</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Dibuat</dt>
              <dd>{formatDateTime(product.createdAt)}</dd>
            </div>
          </dl>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-3">Stock Opname</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="adjQty" className="block text-sm text-gray-600 mb-1">
                  Perubahan Stok (+/-)
                </label>
                <input
                  id="adjQty"
                  type="number"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="contoh: 10 atau -5"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="adjNote" className="block text-sm text-gray-600 mb-1">
                  Catatan (wajib)
                </label>
                <input
                  id="adjNote"
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="contoh: Stock opname bulanan"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={() => adjustMutation.mutate()}
                disabled={!adjQty || !adjNote || adjustMutation.isPending}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {adjustMutation.isPending ? 'Memproses...' : 'Simpan Penyesuaian'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock movements ledger */}
      {isAdmin && movements && (
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">Riwayat Pergerakan Stok</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Tipe</th>
                  <th className="pb-2 font-medium">Perubahan</th>
                  <th className="pb-2 font-medium">Stok Setelah</th>
                  <th className="pb-2 font-medium">Catatan</th>
                  <th className="pb-2 font-medium">Oleh</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-400">Belum ada pergerakan</td>
                  </tr>
                ) : (
                  movements.data.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2 text-gray-600">{formatDateTime(m.createdAt)}</td>
                      <td className="py-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100">{m.type}</span>
                      </td>
                      <td className={`py-2 font-medium ${m.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                      </td>
                      <td className="py-2">{m.stockAfter}</td>
                      <td className="py-2 text-gray-600">{m.note ?? '-'}</td>
                      <td className="py-2 text-gray-600">{m.creator?.name ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

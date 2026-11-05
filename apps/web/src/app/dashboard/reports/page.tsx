'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { SalesReportItem, TopProduct } from '@/types';
import { formatCurrency } from '@/lib/format';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [from, setFrom] = useState(ninetyDaysAgo);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', from, to, groupBy],
    queryFn: async () => {
      const res = await api.get<{ data: SalesReportItem[] }>(
        `/reports/sales?from=${from}&to=${to}&group_by=${groupBy}`,
      );
      return res.data.data;
    },
  });

  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['top-products', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: TopProduct[] }>(
        `/reports/top-products?from=${from}&to=${to}&limit=10`,
      );
      return res.data.data;
    },
  });

  const chartData = (salesData ?? []).map((item) => ({
    ...item,
    period: new Date(item.period).toLocaleDateString('id-ID', {
      day: groupBy === 'day' ? '2-digit' : undefined,
      month: 'short',
      year: 'numeric',
    }),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="r-from" className="block text-xs text-gray-500 mb-1">Dari</label>
            <input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="r-to" className="block text-xs text-gray-500 mb-1">Sampai</label>
            <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="r-group" className="block text-xs text-gray-500 mb-1">Group By</label>
            <select id="r-group" value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'month')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="day">Per Hari</option>
              <option value="month">Per Bulan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales chart */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-4">Omzet per {groupBy === 'day' ? 'Hari' : 'Bulan'}</h2>
        {salesLoading ? (
          <div className="text-gray-500">Memuat...</div>
        ) : chartData.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Tidak ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'totalRevenue' ? [formatCurrency(value), 'Omzet'] : [value, 'Order']
                }
              />
              <Legend formatter={(value) => (value === 'totalRevenue' ? 'Omzet' : 'Total Order')} />
              <Bar dataKey="totalOrders" fill="#3b82f6" name="totalOrders" />
              <Bar dataKey="totalRevenue" fill="#10b981" name="totalRevenue" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top products */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-3">Produk Terlaris</h2>
        {productsLoading ? (
          <div className="text-gray-500">Memuat...</div>
        ) : !topProducts || topProducts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Tidak ada data</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Kode</th>
                <th className="pb-2 font-medium">Produk</th>
                <th className="pb-2 font-medium text-right">Qty Terjual</th>
                <th className="pb-2 font-medium text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.productId} className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">{i + 1}</td>
                  <td className="py-2 font-mono text-xs">{p.productCode}</td>
                  <td className="py-2">{p.productName}</td>
                  <td className="py-2 text-right font-medium">{p.totalQuantity}</td>
                  <td className="py-2 text-right">{formatCurrency(p.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

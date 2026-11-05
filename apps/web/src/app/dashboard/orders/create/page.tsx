'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import api from '@/lib/api';
import { Product, Customer, PaginatedResponse, ApiResponse, Order } from '@/types';
import { formatCurrency } from '@/lib/format';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

const orderSchema = z.object({
  customerId: z.string().uuid('Pilih pelanggan'),
  items: z.array(
    z.object({
      productId: z.number().positive('Pilih produk'),
      quantity: z.number().positive('Qty harus > 0').int('Qty harus angka bulat'),
    }),
  ).min(1, 'Minimal 1 item'),
});

type OrderForm = z.infer<typeof orderSchema>;

export default function CreateOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [rows, setRows] = useState<Array<{ productId: string; quantity: string }>>([{ productId: '', quantity: '1' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(uuidv4());

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Customer>>('/customers?perPage=100');
      return res.data.data;
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Product>>('/products?perPage=100');
      return res.data.data;
    },
  });

  const products = productsData ?? [];
  const customers = customersData ?? [];

  // Calculate total in real-time (client-side preview only; server validates)
  const totalPreview = useMemo(() => {
    let total = 0;
    for (const row of rows) {
      const product = products.find((p) => p.id === row.productId);
      if (product) {
        total += product.price * Number(row.quantity || 0);
      }
    }
    return total;
  }, [rows, products]);

  function addRow() {
    setRows([...rows, { productId: '', quantity: '1' }]);
  }

  function removeRow(index: number) {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  }

  function updateRow(index: number, field: 'productId' | 'quantity', value: string) {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!customerId) newErrors.customerId = 'Pilih pelanggan';

    const productIds: string[] = [];
    rows.forEach((row, i) => {
      if (!row.productId) newErrors[`items.${i}.productId`] = 'Pilih produk';
      else if (productIds.includes(row.productId)) newErrors[`items.${i}.productId`] = 'Produk duplikat';
      else productIds.push(row.productId);

      const qty = Number(row.quantity);
      if (!qty || qty <= 0) newErrors[`items.${i}.quantity`] = 'Qty harus > 0';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        items: rows.map((r) => ({
          productId: Number(r.productId),
          quantity: Number(r.quantity),
        })),
      };
      const res = await api.post<ApiResponse<Order>>('/orders', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data.data;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Order berhasil dibuat');
      router.push(`/dashboard/orders/${order.id}`);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = err?.response?.data?.message ?? 'Gagal membuat order';
      setServerErrors(err?.response?.data?.errors ?? {});
      toast.error(msg);
      // Generate new idempotency key for next attempt
      setIdempotencyKey(uuidv4());
    },
  });

  function handleSubmit() {
    setServerErrors({});
    if (!validate()) return;
    setIsSubmitting(true);
    createMutation.mutate(undefined, {
      onSettled: () => setIsSubmitting(false),
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buat Order</h1>
      </div>

      {/* Customer selection */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">Pelanggan</label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Pilih pelanggan...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.customerName}</option>
          ))}
        </select>
        {errors.customerId && <p className="text-red-500 text-sm mt-1">{errors.customerId}</p>}
      </div>

      {/* Order items */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-3">Item Order</h2>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1">
                <select
                  value={row.productId}
                  onChange={(e) => updateRow(i, 'productId', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  aria-label={`Produk item ${i + 1}`}
                >
                  <option value="">Pilih produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productCode} - {p.productName} ({p.stock} tersisa) - {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
                {(errors[`items.${i}.productId`] || serverErrors[`items.${i}.productId`]) && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[`items.${i}.productId`] ?? serverErrors[`items.${i}.productId`]?.[0]}
                  </p>
                )}
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-center"
                  aria-label={`Jumlah item ${i + 1}`}
                />
                {(errors[`items.${i}.quantity`] || serverErrors[`items.${i}.quantity`]) && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`items.${i}.quantity`] ?? serverErrors[`items.${i}.quantity`]?.[0]}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-30"
                aria-label="Hapus baris"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="mt-3 text-sm text-primary-600 hover:underline">
          + Tambah Item
        </button>
      </div>

      {/* Total */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium text-gray-700">Total Estimasi</span>
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalPreview)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">*Harga final dihitung di server</p>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Memproses...' : 'Simpan Order'}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

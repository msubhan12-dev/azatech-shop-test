'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Customer, PaginatedResponse, ApiResponse } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const emptyForm = { customerName: '', customerAddress: '', gender: 'Pria' as 'Pria' | 'Wanita', birthDate: '', phone: '', email: '' };

export default function CustomersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const page = Number(searchParams.get('page') ?? 1);
  const perPage = Number(searchParams.get('perPage') ?? 10);
  const search = searchParams.get('search') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  const sortOrder = searchParams.get('sortOrder') ?? 'desc';

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, perPage, search, sortBy, sortOrder }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page), perPage: String(perPage), sortBy, sortOrder,
        ...(search && { search }),
      });
      const res = await api.get<PaginatedResponse<Customer>>(`/customers?${params}`);
      return res.data;
    },
  });

  const [searchInput, setSearchInput] = useState(search);
  useMemo(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== search) updateQuery({ search: searchInput, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function updateQuery(params: Record<string, string | number>) {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) newParams.set(key, String(value));
      else newParams.delete(key);
    });
    router.push(`${pathname}?${newParams.toString()}`);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/customers', {
        ...form,
        birthDate: form.birthDate || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Pelanggan berhasil ditambahkan');
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Gagal menambahkan pelanggan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/customers/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pelanggan berhasil dihapus');
    },
    onError: () => toast.error('Gagal menghapus pelanggan'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pelanggan</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
        >
          {showForm ? 'Tutup' : 'Tambah Pelanggan'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cname" className="block text-sm text-gray-600 mb-1">Nama</label>
              <input id="cname" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label htmlFor="caddr" className="block text-sm text-gray-600 mb-1">Alamat</label>
              <input id="caddr" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label htmlFor="cgender" className="block text-sm text-gray-600 mb-1">Gender</label>
              <select id="cgender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'Pria' | 'Wanita' })}
                className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="Pria">Pria</option>
                <option value="Wanita">Wanita</option>
              </select>
            </div>
            <div>
              <label htmlFor="cbirth" className="block text-sm text-gray-600 mb-1">Tgl Lahir</label>
              <input id="cbirth" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label htmlFor="cphone" className="block text-sm text-gray-600 mb-1">Telepon</label>
              <input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label htmlFor="cemail" className="block text-sm text-gray-600 mb-1">Email</label>
              <input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.customerName || !form.customerAddress || createMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Cari pelanggan..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2"
        aria-label="Cari pelanggan"
      />

      {isLoading && <div className="text-gray-500">Memuat...</div>}

      {data && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Alamat</th>
                  <th className="px-4 py-3 font-medium">Gender</th>
                  <th className="px-4 py-3 font-medium">Telepon</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  {isAdmin && <th className="px-4 py-3 font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-400">Tidak ada pelanggan</td></tr>
                ) : (
                  data.data.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{c.customerAddress}</td>
                      <td className="px-4 py-3">{c.gender}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email ?? '-'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { if (confirm(`Hapus pelanggan "${c.customerName}"?`)) deleteMutation.mutate(c.id); }}
                            className="text-red-600 hover:underline text-xs"
                          >Hapus</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total: {data.meta.total} pelanggan</p>
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

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { User } from '@/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'cashier'] },
  { href: '/dashboard/products', label: 'Produk', icon: Package, roles: ['admin', 'cashier'] },
  { href: '/dashboard/customers', label: 'Pelanggan', icon: Users, roles: ['admin', 'cashier'] },
  { href: '/dashboard/orders', label: 'Order', icon: ShoppingCart, roles: ['admin', 'cashier'] },
  { href: '/dashboard/reports', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
];

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const role = user?.role ?? 'cashier';

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Azatech Shop</h1>
        <p className="text-sm text-gray-500 mt-1">Order Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
            {role === 'admin' ? 'Admin' : 'Kasir'}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

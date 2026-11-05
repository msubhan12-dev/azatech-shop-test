import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/orders/create',
}));

// Mock useQuery to return test data
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockImplementation(({ queryKey }) => {
    if (queryKey[0] === 'customers-all') {
      return {
        data: [{ id: 'cust-1', customerName: 'Test Customer' }],
      };
    }
    if (queryKey[0] === 'products-all') {
      return {
        data: [
          { id: '1', productCode: 'P001', productName: 'Test Product', stock: 10, price: 10000 },
          { id: '2', productCode: 'P002', productName: 'Product 2', stock: 5, price: 20000 },
        ],
      };
    }
    return { data: undefined };
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-idempotency-key',
}));

// Mock api
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  tokenStorage: {
    getAccess: () => 'test-token',
  },
}));

import CreateOrderPage from '../app/dashboard/orders/create/page';

describe('CreateOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders customer selection and item rows', async () => {
    render(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('Buat Order')).toBeInTheDocument();
    });

    // Customer dropdown
    expect(screen.getByLabelText('Pelanggan')).toBeInTheDocument();

    // At least one product row
    expect(screen.getAllByLabelText(/Produk item/)).toHaveLength(1);
  });

  it('can add and remove item rows', async () => {
    const user = userEvent.setup();
    render(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('+ Tambah Item')).toBeInTheDocument();
    });

    // Start with 1 row
    expect(screen.getAllByLabelText(/Produk item/)).toHaveLength(1);

    // Add a row
    await user.click(screen.getByText('+ Tambah Item'));
    expect(screen.getAllByLabelText(/Produk item/)).toHaveLength(2);

    // Remove second row
    const removeButtons = screen.getAllByLabelText('Hapus baris');
    await user.click(removeButtons[1]);
    expect(screen.getAllByLabelText(/Produk item/)).toHaveLength(1);
  });

  it('shows validation error when no customer selected', async () => {
    const user = userEvent.setup();
    render(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('Simpan Order')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Simpan Order'));

    await waitFor(() => {
      expect(screen.getByText('Pilih pelanggan')).toBeInTheDocument();
    });
  });

  it('calculates total preview', async () => {
    const user = userEvent.setup();
    render(<CreateOrderPage />);

    await waitFor(() => {
      // Product name appears in select option text
      expect(screen.getByText(/Test Product/)).toBeInTheDocument();
    });

    // Select a product
    const productSelect = screen.getAllByLabelText(/Produk item/)[0] as HTMLSelectElement;
    await user.selectOptions(productSelect, '1');

    // Total should show product price * qty (1 * 10000)
    // Use a flexible matcher since Intl formatting may vary by environment
    await waitFor(() => {
      const totalElement = screen.getByText(/Total Estimasi/).parentElement;
      const totalText = totalElement?.querySelector('span:last-child')?.textContent ?? '';
      // Should contain 10000 formatted somehow (10,000 or 10.000 etc)
      expect(totalText).toMatch(/10[.,]000/);
    }, { timeout: 3000 });
  });
});

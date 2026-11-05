'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api, { tokenStorage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { User, ApiResponse } from '@/types';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, setUser, logout: clearAuth } = useAuthStore();

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User>>('/auth/me');
      return res.data.data;
    },
    enabled: !!tokenStorage.getAccess(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await api.post<ApiResponse<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>>('/auth/login', credentials);
      return res.data.data;
    },
    onSuccess: (data) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      queryClient.setQueryData(['me'], data.user);
      toast.success('Login berhasil');
      router.push('/dashboard');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Login gagal';
      toast.error(msg);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.push('/login');
      toast.success('Logout berhasil');
    },
  });

  return {
    user: meData ?? user,
    isAuthenticated: isAuthenticated || !!meData,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
  };
}

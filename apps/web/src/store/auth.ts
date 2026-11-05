'use client';
import { create } from 'zustand';
import { User } from '@/types';
import { tokenStorage } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  logout: () => {
    tokenStorage.clear();
    set({ user: null, isAuthenticated: false });
  },
}));

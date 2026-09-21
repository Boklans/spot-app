import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  init: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
    name?: string,
    language?: 'en' | 'uk'
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    if (!isSupabaseConfigured()) {
      set({ initialized: true, loading: false });
      return;
    }

    try {
      set({ loading: true });
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        set({ user: null, session: null, initialized: true, loading: false });
        return;
      }

      set({
        session: data.session,
        user: data.session?.user ?? null,
        initialized: true,
        loading: false,
      });

      // Listen to auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
        });
      });
    } catch {
      set({ initialized: true, loading: false });
    }
  },

  signInWithPassword: async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase credentials are not configured yet.' };
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please check your network connection.';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  signUpWithPassword: async (
    email: string,
    password: string,
    name?: string,
    language: 'en' | 'uk' = 'uk'
  ) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase credentials are not configured yet.' };
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name?.trim() || 'Athlete',
            language,
          },
        },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please try again.';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      set({ user: null, session: null });
      return;
    }

    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null, loading: false, error: null });
    } catch {
      set({ user: null, session: null, loading: false });
    }
  },

  resetPassword: async (email: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase credentials are not configured yet.' };
    }

    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      set({ loading: false });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      set({ loading: false });
      return { success: false, error: err?.message || 'Password reset request failed.' };
    }
  },

  clearError: () => set({ error: null }),
}));

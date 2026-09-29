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
  signInWithPassword: (
    email: string,
    password: string,
    language?: 'en' | 'uk'
  ) => Promise<{ success: boolean; error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
    name?: string,
    language?: 'en' | 'uk'
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (
    email: string,
    language?: 'en' | 'uk'
  ) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

function formatAuthError(err: any, language: 'en' | 'uk' = 'uk'): string {
  const msg = err?.message || (typeof err === 'string' ? err : '');
  if (
    msg.includes('hostname could not be found') ||
    msg.includes('Could not resolve host') ||
    msg.includes('Network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('UnexpectedException')
  ) {
    return language === 'uk'
      ? 'Неможливо з\'єднатися із сервером Supabase. Перевірте підключення до інтернету, або перевірте статус проєкту в Supabase Dashboard (проєкт міг бути призупинений / paused через неактивність).'
      : 'Cannot connect to Supabase server. Check your internet connection, or verify project status in Supabase Dashboard (the project may be paused due to inactivity).';
  }
  if (msg.includes('User already registered')) {
    return language === 'uk'
      ? 'Користувач із такою поштою вже зареєстрований'
      : 'User with this email already exists';
  }
  if (msg.includes('Invalid login credentials')) {
    return language === 'uk'
      ? 'Невірний email або пароль'
      : 'Invalid email or password';
  }
  return msg || (language === 'uk' ? 'Помилка мережі або сервера. Спробуйте ще раз.' : 'Network or server error. Please try again.');
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

  signInWithPassword: async (email: string, password: string, language: 'en' | 'uk' = 'uk') => {
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
        const formatted = formatAuthError(error, language);
        set({ loading: false, error: formatted });
        return { success: false, error: formatted };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = formatAuthError(err, language);
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
        const formatted = formatAuthError(error, language);
        set({ loading: false, error: formatted });
        return { success: false, error: formatted };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = formatAuthError(err, language);
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

  resetPassword: async (email: string, language: 'en' | 'uk' = 'uk') => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase credentials are not configured yet.' };
    }

    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      set({ loading: false });
      if (error) {
        const formatted = formatAuthError(error, language);
        return { success: false, error: formatted };
      }
      return { success: true };
    } catch (err: any) {
      const msg = formatAuthError(err, language);
      set({ loading: false });
      return { success: false, error: msg };
    }
  },

  clearError: () => set({ error: null }),
}));


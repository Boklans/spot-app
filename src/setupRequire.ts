declare global {
  const __DEV__: boolean;
}

// Polyfill global require('@/assets/...'), __DEV__, and process.env for Expo/React Native modules in browser
const g = globalThis as unknown as {
  require?: (id: string) => string;
  __DEV__?: boolean;
  process?: { env: Record<string, string | undefined> };
};

g.__DEV__ = true;

if (!g.process) {
  g.process = {
    env: {
      EXPO_PUBLIC_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
  };
}

g.require = (id: string): string => {
  if (id.startsWith('@/assets/')) {
    return id.replace('@/assets/', '/assets/');
  }
  if (id.startsWith('./assets/') || id.startsWith('../assets/')) {
    return '/assets/' + id.split('/assets/')[1];
  }
  return id;
};

export {};

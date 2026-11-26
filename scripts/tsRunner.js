/**
 * SPOT 2.0 Real-Module TypeScript Test Runner
 * Transpiles and executes actual production .ts / .tsx modules in Node.js
 * with deterministic in-memory AsyncStorage, controllable Supabase/Notifications
 * mocks, and zero copy-pasted logic clones.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');

// ─── In-Memory AsyncStorage ─────────────────────────────────────────────────
const storageMap = new Map();

const memoryAsyncStorage = {
  async getItem(key) {
    return storageMap.has(key) ? storageMap.get(key) : null;
  },
  async setItem(key, value) {
    storageMap.set(key, String(value));
  },
  async removeItem(key) {
    storageMap.delete(key);
  },
  async multiGet(keys) {
    return keys.map((k) => [k, storageMap.has(k) ? storageMap.get(k) : null]);
  },
  async multiSet(pairs) {
    for (const [k, v] of pairs) {
      storageMap.set(k, String(v));
    }
  },
  async multiRemove(keys) {
    for (const k of keys) {
      storageMap.delete(k);
    }
  },
  async getAllKeys() {
    return Array.from(storageMap.keys());
  },
  async clear() {
    storageMap.clear();
  },
};

function resetMemoryStorage(initialEntries = {}) {
  storageMap.clear();
  for (const [k, v] of Object.entries(initialEntries)) {
    storageMap.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
}

function dumpMemoryStorage() {
  const out = {};
  for (const [k, v] of storageMap.entries()) {
    out[k] = v;
  }
  return out;
}

// ─── Controllable Supabase & Notifications Mocks ────────────────────────────
let activeSupabaseMock = null;

function createDefaultSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      resend: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async () => ({ data: null, error: null }),
    from: () => {
      const chain = {
        select: () => chain,
        upsert: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }),
        update: () => chain,
        delete: () => chain,
        eq: () => chain,
        in: async () => ({ data: null, error: null }),
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return chain;
    },
  };
}

function setSupabaseMock(customMock) {
  activeSupabaseMock = customMock;
}

function getSupabaseProxy() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const impl = activeSupabaseMock || createDefaultSupabaseMock();
        const val = impl[prop];
        return typeof val === 'function' ? val.bind(impl) : val;
      },
    }
  );
}

const notificationsState = {
  scheduled: [],
  dismissed: [],
  permissionsGranted: true,
  lastResponse: null,
};

function resetNotificationsMock() {
  notificationsState.scheduled = [];
  notificationsState.dismissed = [];
  notificationsState.permissionsGranted = true;
  notificationsState.lastResponse = null;
}

const expoNotificationsMock = {
  AndroidNotificationPriority: { HIGH: 'high', MAX: 'max', DEFAULT: 'default', LOW: 'low' },
  AndroidImportance: { HIGH: 4, MAX: 5, DEFAULT: 3, LOW: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly', DATE: 'date' },
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  setNotificationCategoryAsync: async () => {},
  getPermissionsAsync: async () => ({
    status: notificationsState.permissionsGranted ? 'granted' : 'undetermined',
    granted: notificationsState.permissionsGranted,
  }),
  requestPermissionsAsync: async () => ({
    status: notificationsState.permissionsGranted ? 'granted' : 'denied',
    granted: notificationsState.permissionsGranted,
  }),
  scheduleNotificationAsync: async (req) => {
    const id = req.identifier || `notif-${notificationsState.scheduled.length + 1}`;
    notificationsState.scheduled.push({ ...req, identifier: id });
    return id;
  },
  cancelScheduledNotificationAsync: async (id) => {
    notificationsState.scheduled = notificationsState.scheduled.filter((n) => n.identifier !== id);
  },
  cancelAllScheduledNotificationsAsync: async () => {
    notificationsState.scheduled = [];
  },
  getAllScheduledNotificationsAsync: async () => [...notificationsState.scheduled],
  dismissNotificationAsync: async (id) => {
    notificationsState.dismissed.push(id);
  },
  dismissAllNotificationsAsync: async () => {},
  getLastNotificationResponseAsync: async () => notificationsState.lastResponse,
  clearLastNotificationResponseAsync: async () => {
    notificationsState.lastResponse = null;
  },
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  addNotificationReceivedListener: () => ({ remove: () => {} }),
};

// ─── Module Loader & Transpiler ─────────────────────────────────────────────
const moduleCache = new Map();

function clearModuleCache() {
  moduleCache.clear();
}

function resolveCandidateFile(basePath) {
  const candidates = [
    basePath,
    basePath + '.ts',
    basePath + '.tsx',
    basePath + '.js',
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const builtInMocks = {
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: memoryAsyncStorage,
    ...memoryAsyncStorage,
  },
  'react-native': {
    Platform: {
      OS: 'ios',
      select: (obj) => (obj && ('ios' in obj ? obj.ios : obj.default)),
    },
    Alert: { alert: () => {} },
    AppState: {
      currentState: 'active',
      addEventListener: () => ({ remove: () => {} }),
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    StyleSheet: {
      create: (styles) => styles,
      hairlineWidth: 0.5,
    },
  },
  'expo-haptics': {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    impactAsync: async () => {},
    notificationAsync: async () => {},
    selectionAsync: async () => {},
  },
  'expo-notifications': expoNotificationsMock,
  'expo-constants': {
    __esModule: true,
    default: { expoConfig: { extra: {} } },
  },
  'expo-audio': {
    createAudioPlayer: () => ({ play: () => {}, remove: () => {} }),
    setAudioModeAsync: async () => {},
  },
  'react-native-purchases': {
    __esModule: true,
    default: {
      LOG_LEVEL: { WARN: 'WARN', DEBUG: 'DEBUG' },
      setLogLevel: () => {},
      configure: () => {},
      getCustomerInfo: async () => ({ entitlements: { active: {} } }),
      getOfferings: async () => ({ current: null }),
      logIn: async () => ({ customerInfo: { entitlements: { active: {} } } }),
      logOut: async () => ({ entitlements: { active: {} } }),
      addCustomerInfoUpdateListener: () => {},
    },
    LOG_LEVEL: { WARN: 'WARN', DEBUG: 'DEBUG' },
  },
};

function loadTsModule(relOrAbsPath) {
  const fullPath = path.isAbsolute(relOrAbsPath)
    ? resolveCandidateFile(relOrAbsPath) || relOrAbsPath
    : resolveCandidateFile(path.resolve(ROOT, relOrAbsPath));

  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new Error(`Cannot resolve TS module: ${relOrAbsPath}`);
  }

  if (/\.(jpg|jpeg|png|gif|webp|mp4|mp3|wav|ttf|otf)$/i.test(fullPath)) {
    return { __assetPath: path.relative(ROOT, fullPath).replace(/\\/g, '/') };
  }

  // Intercept lib/supabase.ts when activeSupabaseMock is configured or in offline Node tests
  const normalizedRel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
  if (normalizedRel === 'lib/supabase.ts') {
    return {
      __esModule: true,
      supabase: getSupabaseProxy(),
    };
  }

  if (moduleCache.has(fullPath)) {
    return moduleCache.get(fullPath).exports;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  moduleCache.set(fullPath, mod);

  const localRequire = (specifier) => {
    if (specifier in builtInMocks) {
      return builtInMocks[specifier];
    }
    if (specifier.startsWith('@/')) {
      const targetRel = specifier.slice(2);
      return loadTsModule(targetRel);
    }
    if (specifier.startsWith('.')) {
      const resolved = resolveCandidateFile(path.resolve(path.dirname(fullPath), specifier));
      if (resolved) {
        return loadTsModule(resolved);
      }
    }
    return require(specifier);
  };

  const fn = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) {\n${transpiled.outputText}\n})`,
    { filename: fullPath }
  );
  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

module.exports = {
  ROOT,
  loadTsModule,
  clearModuleCache,
  memoryAsyncStorage,
  resetMemoryStorage,
  dumpMemoryStorage,
  setSupabaseMock,
  createDefaultSupabaseMock,
  notificationsState,
  resetNotificationsMock,
};

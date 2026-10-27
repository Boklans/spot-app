const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage quota errors
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  async multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
    return Promise.all(keys.map(async (k) => [k, await AsyncStorage.getItem(k)]));
  },
  async multiSet(keyValuePairs: readonly [string, string][]): Promise<void> {
    for (const [k, v] of keyValuePairs) {
      await AsyncStorage.setItem(k, v);
    }
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) {
      await AsyncStorage.removeItem(k);
    }
  },
  async clear(): Promise<void> {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  },
  async getAllKeys(): Promise<readonly string[]> {
    try {
      return Object.keys(window.localStorage);
    } catch {
      return [];
    }
  },
};

export default AsyncStorage;

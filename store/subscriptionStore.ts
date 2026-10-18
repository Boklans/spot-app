import { create } from 'zustand';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  getCustomerInfo,
  getOfferings,
  hasProEntitlement,
  initPurchases,
  purchasePackage as apiPurchasePackage,
  restorePurchases as apiRestorePurchases,
  syncPurchasesUser,
} from '@/lib/purchases';

interface SubscriptionState {
  isPro: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  packages: PurchasesPackage[];

  init: (userId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  syncUser: (userId: string | null) => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; userCancelled?: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; isPro: boolean; error?: string }>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro: false,
  isLoading: false,
  customerInfo: null,
  currentOffering: null,
  packages: [],

  init: async (userId?: string) => {
    set({ isLoading: true });
    try {
      const initialized = await initPurchases(userId);
      if (!initialized) {
        set({ isLoading: false });
        return;
      }

      const [customerInfo, offering] = await Promise.all([
        getCustomerInfo(),
        getOfferings(),
      ]);

      const isPro = hasProEntitlement(customerInfo);
      set({
        isPro,
        customerInfo,
        currentOffering: offering,
        packages: offering?.availablePackages || [],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    try {
      const [customerInfo, offering] = await Promise.all([
        getCustomerInfo(),
        getOfferings(),
      ]);
      const isPro = hasProEntitlement(customerInfo);
      set({
        isPro,
        customerInfo,
        currentOffering: offering,
        packages: offering?.availablePackages || [],
      });
    } catch (err) {
      if (__DEV__) {
        console.warn('[SubscriptionStore] refresh failed:', err);
      }
    }
  },

  syncUser: async (userId: string | null) => {
    try {
      const customerInfo = await syncPurchasesUser(userId);
      if (customerInfo) {
        const isPro = hasProEntitlement(customerInfo);
        set({ isPro, customerInfo });
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[SubscriptionStore] syncUser failed:', err);
      }
    }
  },

  purchase: async (pkg: PurchasesPackage) => {
    set({ isLoading: true });
    try {
      const result = await apiPurchasePackage(pkg);
      if (result.success) {
        set({
          isPro: true,
          customerInfo: result.customerInfo || get().customerInfo,
          isLoading: false,
        });
        return { success: true };
      }
      set({ isLoading: false });
      return {
        success: false,
        userCancelled: result.userCancelled,
        error: result.error,
      };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err?.message || 'Purchase error' };
    }
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const result = await apiRestorePurchases();
      set({
        isPro: result.isPro,
        customerInfo: result.customerInfo || get().customerInfo,
        isLoading: false,
      });
      return result;
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, isPro: false, error: err?.message || 'Restore error' };
    }
  },
}));

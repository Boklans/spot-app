import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';
export const PREMIUM_FALLBACK_ENTITLEMENT_ID = 'premium';

const DEFAULT_REVENUECAT_GOOGLE_KEY = 'goog_xxHTIYpdvQpswBTmuIEaPlFKzAE';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || DEFAULT_REVENUECAT_GOOGLE_KEY;
const APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';

let isInitialized = false;

/**
 * Check if the current platform supports native in-app purchases.
 */
export function isPurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Safely initialize RevenueCat SDK.
 * Will not crash on Web or Expo Go where native modules may not be linked.
 */
export async function initPurchases(userId?: string): Promise<boolean> {
  if (!isPurchasesSupported()) {
    return false;
  }

  const apiKey = Platform.OS === 'ios' ? APPLE_API_KEY : GOOGLE_API_KEY;

  if (!apiKey) {
    if (__DEV__) {
      console.warn('[Purchases] No RevenueCat API key provided for platform:', Platform.OS);
    }
    return false;
  }

  try {
    const configured = await Purchases.isConfigured();
    if (!configured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({
        apiKey,
        appUserID: userId || undefined,
      });
    } else if (userId) {
      await Purchases.logIn(userId);
    }
    isInitialized = true;
    return true;
  } catch (error) {
    // Expo Go fallback or native module linking error
    if (__DEV__) {
      console.warn(
        '[Purchases] Failed to initialize RevenueCat. In Expo Go or web, native purchases are disabled.',
        error
      );
    }
    return false;
  }
}

/**
 * Check whether the given customer info has active PRO or PREMIUM entitlements.
 */
export function hasProEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
    return false;
  }

  const pro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const premium = customerInfo.entitlements.active[PREMIUM_FALLBACK_ENTITLEMENT_ID];

  return Boolean(pro?.isActive || premium?.isActive);
}

/**
 * Fetch latest customer info from RevenueCat.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported() || !isInitialized) {
    return null;
  }

  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    if (__DEV__) {
      console.warn('[Purchases] getCustomerInfo failed:', err);
    }
    return null;
  }
}

/**
 * Fetch available offerings (paywall packages) from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isPurchasesSupported() || !isInitialized) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (err) {
    if (__DEV__) {
      console.warn('[Purchases] getOfferings failed:', err);
    }
    return null;
  }
}

/**
 * Purchase a selected package.
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<{ success: boolean; customerInfo?: CustomerInfo; userCancelled?: boolean; error?: string }> {
  if (!isPurchasesSupported() || !isInitialized) {
    return { success: false, error: 'Purchases not available on this platform' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = hasProEntitlement(customerInfo);
    return { success: isPro, customerInfo };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, userCancelled: true };
    }
    return { success: false, error: err?.message || 'Purchase failed' };
  }
}

/**
 * Restore previous purchases.
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  isPro: boolean;
  error?: string;
}> {
  if (!isPurchasesSupported() || !isInitialized) {
    return { success: false, isPro: false, error: 'Purchases not available' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPro = hasProEntitlement(customerInfo);
    return { success: true, customerInfo, isPro };
  } catch (err: any) {
    return { success: false, isPro: false, error: err?.message || 'Restore failed' };
  }
}

/**
 * Associate user with Supabase ID or log out.
 */
export async function syncPurchasesUser(userId: string | null): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported() || !isInitialized) {
    return null;
  }

  try {
    if (userId) {
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    } else {
      const customerInfo = await Purchases.logOut();
      return customerInfo;
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[Purchases] syncPurchasesUser failed:', err);
    }
    return null;
  }
}

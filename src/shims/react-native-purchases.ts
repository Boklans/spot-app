export enum LOG_LEVEL {
  VERBOSE = 'VERBOSE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface PurchasesEntitlementInfo {
  identifier: string;
  isActive: boolean;
}

export interface CustomerInfo {
  entitlements: {
    all: Record<string, PurchasesEntitlementInfo>;
    active: Record<string, PurchasesEntitlementInfo>;
  };
  activeSubscriptions: string[];
  originalAppUserId: string;
}

export interface PurchasesStoreProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
}

export interface PurchasesPackage {
  identifier: string;
  packageType: string;
  product: PurchasesStoreProduct;
  offeringIdentifier: string;
}

export interface PurchasesOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: PurchasesPackage[];
  annual?: PurchasesPackage | null;
  monthly?: PurchasesPackage | null;
}

const Purchases = {
  LOG_LEVEL,
  async isConfigured(): Promise<boolean> {
    return false;
  },
  async setLogLevel(_level: LOG_LEVEL): Promise<void> {},
  configure(_config: { apiKey: string; appUserID?: string }): void {},
  async logIn(_appUserID: string): Promise<{ customerInfo: CustomerInfo; created: boolean }> {
    return {
      created: false,
      customerInfo: {
        entitlements: { all: {}, active: {} },
        activeSubscriptions: [],
        originalAppUserId: _appUserID,
      },
    };
  },
  async logOut(): Promise<CustomerInfo> {
    return {
      entitlements: { all: {}, active: {} },
      activeSubscriptions: [],
      originalAppUserId: 'anonymous',
    };
  },
  async getCustomerInfo(): Promise<CustomerInfo> {
    return {
      entitlements: { all: {}, active: {} },
      activeSubscriptions: [],
      originalAppUserId: 'anonymous',
    };
  },
  async getOfferings(): Promise<{ current: PurchasesOffering | null; all: Record<string, PurchasesOffering> }> {
    return { current: null, all: {} };
  },
  async purchasePackage(_pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }> {
    return {
      customerInfo: {
        entitlements: { all: {}, active: {} },
        activeSubscriptions: [],
        originalAppUserId: 'anonymous',
      },
    };
  },
  async restorePurchases(): Promise<CustomerInfo> {
    return {
      entitlements: { all: {}, active: {} },
      activeSubscriptions: [],
      originalAppUserId: 'anonymous',
    };
  },
};

export default Purchases;

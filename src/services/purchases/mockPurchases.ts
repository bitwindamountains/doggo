import type { Entitlement, PurchaseService } from './PurchaseService';

export function createMockPurchases(): PurchaseService {
  const ents: Record<Entitlement, boolean> = { premium: false };
  return {
    getEntitlements: async () => ({ ...ents }),
    purchase: async () => {
      ents.premium = true;
      return true;
    },
    restore: async () => ({ ...ents }),
    getTrialEnd: async () => null,
  };
}

/** Release builds without RevenueCat keys: nothing to buy, Premium stays off. */
export function createUnavailablePurchases(): PurchaseService {
  return {
    getEntitlements: async () => ({ premium: false }),
    purchase: async () => false,
    restore: async () => ({ premium: false }),
    getTrialEnd: async () => null,
  };
}

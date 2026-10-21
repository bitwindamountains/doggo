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
  };
}

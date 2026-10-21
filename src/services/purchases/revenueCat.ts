// RevenueCat (MILESTONES M9). Source: react-native-purchases README and type definitions
// (configure, getCustomerInfo, getOfferings, purchasePackage, restorePurchases).
// Products and the `premium` entitlement are set up in the RevenueCat dashboard ([HUMAN]).

import Purchases, { type CustomerInfo } from 'react-native-purchases';

import type { Entitlement, PurchaseService } from './PurchaseService';

const ENTITLEMENT: Entitlement = 'premium';

const entitlements = (info: CustomerInfo): Record<Entitlement, boolean> => ({
  premium: info.entitlements.active[ENTITLEMENT]?.isActive === true,
});

export function createRevenueCat(apiKey: string): PurchaseService {
  Purchases.configure({ apiKey });
  return {
    getEntitlements: async () => entitlements(await Purchases.getCustomerInfo()),
    async purchase(productId) {
      const offering = (await Purchases.getOfferings()).current;
      const pkg = productId === 'annual' ? offering?.annual : offering?.monthly;
      if (!pkg) return false;
      try {
        return entitlements((await Purchases.purchasePackage(pkg)).customerInfo).premium;
      } catch (e) {
        // A cancelled purchase is not an error for the user.
        if ((e as { userCancelled?: boolean }).userCancelled) return false;
        throw e;
      }
    },
    restore: async () => entitlements(await Purchases.restorePurchases()),
    async getTrialEnd() {
      const e = (await Purchases.getCustomerInfo()).entitlements.active[ENTITLEMENT];
      return e?.periodType === 'TRIAL' && e.willRenew ? e.expirationDate : null;
    },
  };
}

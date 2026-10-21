// Purchases (RevenueCat in M9). Premium is cosmetics and features only (CLAUDE.md rule 5).

export type Entitlement = 'premium';

export interface PurchaseService {
  getEntitlements(): Promise<Record<Entitlement, boolean>>;
  purchase(productId: 'monthly' | 'annual'): Promise<boolean>;
  restore(): Promise<Record<Entitlement, boolean>>;
}

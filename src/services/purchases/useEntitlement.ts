// The one place Premium is checked (PRD F12 AC).

import { useEffect, useState } from 'react';

import { useApp } from '@/components/AppProvider';

import type { Entitlement } from './PurchaseService';

export function useEntitlement(entitlement: Entitlement): boolean {
  const { services } = useApp();
  const [active, setActive] = useState(false);
  useEffect(() => {
    let alive = true;
    services.purchases
      .getEntitlements()
      .then((e) => alive && setActive(e[entitlement]))
      .catch(() => alive && setActive(false));
    return () => {
      alive = false;
    };
  }, [services, entitlement]);
  return active;
}

// Apple's app picker is a native view, not a function. presentAppPicker() opens the
// /pick-apps modal and resolves when that screen reports how many items were picked.

import { router } from 'expo-router';

let pending: ((result: { count: number }) => void) | null = null;

export function openAppPicker(groupId: string): Promise<{ count: number }> {
  pending?.({ count: 0 });
  return new Promise((resolve) => {
    pending = resolve;
    router.push({ pathname: '/pick-apps', params: { groupId } });
  });
}

export function finishAppPicker(count: number): void {
  pending?.({ count });
  pending = null;
}

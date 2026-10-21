// Renders screens inside a real AppProvider over an in-memory database and persona mocks.

import { render, waitFor } from '@testing-library/react-native';

import { AppProvider } from '@/components/AppProvider';
import { createTestDb } from '@/data/__tests__/testDb';
import type { Db } from '@/data';
import { PERSONAS } from '@/engine/sim/personas';
import { applyPersona } from '@/features/settings/applyPersona';
import { createMockServices, type Services } from '@/services';
import { currentPersona, nowMs, useDevStore } from '@/store/dev';
import { useDogStore } from '@/store/dogStore';

/** The expo-router stub from jest.setup.ts. */
export const router = (
  jest.requireMock('expo-router') as { router: Record<'push' | 'back' | 'replace', jest.Mock> }
).router;

/** Sets the app clock to `hhmm` today in Asia/Manila (UTC+8). */
export function setClock(hhmm: string, day = '2026-10-21') {
  const target = Date.parse(`${day}T${hhmm}:00+08:00`);
  useDevStore.setState({ offsetMs: target - Date.now() });
}

export async function renderWith(
  ui: React.ReactElement,
  opts: {
    persona?: keyof typeof PERSONAS;
    at?: string;
    onboard?: boolean;
    seed?: (db: Db, now: string) => void;
  } = {},
): Promise<{ db: Db; services: Services }> {
  useDevStore.setState({ personaId: opts.persona ?? 'desk-worker' });
  useDogStore.setState({ output: null, dog: null, prefs: null, celebrate: [] });
  setClock(opts.at ?? '10:00');
  const db = await createTestDb();
  const services = createMockServices(currentPersona, nowMs);
  await services.health.requestPermissions();
  const now = new Date(nowMs()).toISOString();
  if (opts.onboard !== false) applyPersona(db, currentPersona(), now);
  opts.seed?.(db, now);
  await render(
    <AppProvider db={db} services={services}>
      {ui}
    </AppProvider>,
  );
  if (opts.onboard !== false)
    await waitFor(() => expect(useDogStore.getState().output).not.toBeNull());
  return { db, services };
}

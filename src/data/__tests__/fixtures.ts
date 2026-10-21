import type { DogProfile } from '@/engine';

import { DEFAULT_STORED_PREFS, type StoredPrefs } from '../repos';

export const PREFS: StoredPrefs = {
  ...DEFAULT_STORED_PREFS,
  onboardedAt: '2026-10-01T00:00:00.000Z',
};

export const DOG: DogProfile = {
  id: 'dog-1',
  name: 'Biscuit',
  breed: 'aspin',
  adoptedAt: '2026-09-01T00:00:00.000Z',
  adoptedAsSenior: false,
  bondPoints: 40,
  goodDaysTotal: 5,
  walksTotal: 7,
  tricks: ['sit'],
};

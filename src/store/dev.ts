// Dev menu state: which persona drives the mock services, and how far the clock is
// fast-forwarded. In release builds both stay at their defaults.

import { create } from 'zustand';

import { PERSONAS, type Persona } from '@/engine/sim/personas';

interface DevState {
  personaId: string;
  offsetMs: number;
  setPersona(id: string): void;
  advance(ms: number): void;
  resetClock(): void;
}

export const useDevStore = create<DevState>((set) => ({
  personaId: 'desk-worker',
  offsetMs: 0,
  setPersona: (personaId) => set({ personaId }),
  advance: (ms) => set((s) => ({ offsetMs: s.offsetMs + ms })),
  resetClock: () => set({ offsetMs: 0 }),
}));

/** The app's clock: real time plus the dev offset. */
export function nowMs(): number {
  return Date.now() + useDevStore.getState().offsetMs;
}

export function currentPersona(): Persona {
  const id = useDevStore.getState().personaId;
  return (PERSONAS as Record<string, Persona>)[id] ?? PERSONAS['desk-worker'];
}

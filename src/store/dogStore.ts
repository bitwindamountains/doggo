// The latest computed dog, shared by every screen. Written only by refreshDog().

import { create } from 'zustand';

import type { DogProfile, EngineOutput, TrickId } from '@/engine';
import type { StoredPrefs } from '@/data';

interface DogStore {
  output: EngineOutput | null;
  dog: DogProfile | null;
  prefs: StoredPrefs | null;
  /** Tricks learned since the user last saw a celebration. */
  celebrate: TrickId[];
  set(values: Partial<Pick<DogStore, 'output' | 'dog' | 'prefs' | 'celebrate'>>): void;
}

export const useDogStore = create<DogStore>((set) => ({
  output: null,
  dog: null,
  prefs: null,
  celebrate: [],
  set: (values) => set(values),
}));

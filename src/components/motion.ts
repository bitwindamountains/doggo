// Motion tokens (strong ease-outs, no bounce). Every animation checks reduce motion first:
// the reduced state is the finished state.

import { Easing } from 'react-native';

export const ease = {
  out: Easing.bezier(0.22, 1, 0.36, 1), // entrances, UI under 600 ms
  expo: Easing.bezier(0.16, 1, 0.3, 1), // longer reveals
  inOut: Easing.bezier(0.76, 0, 0.24, 1), // things that travel while visible
  soft: Easing.bezier(0.33, 1, 0.68, 1), // slow loops (breathing, drift)
};

export const t = {
  press: 140,
  ui: 240,
  reveal: 600,
  stagger: 70,
};

// Shared Jest setup: safe-area context mock and an expo-router stub for screen tests.

import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  const Null = () => null;
  return {
    router,
    useRouter: () => router,
    Redirect: Null,
    Stack: Object.assign(Null, { Screen: Null }),
    Tabs: Object.assign(Null, { Screen: Null }),
  };
});

// Tests run with the OS "reduce motion" setting on: native-driver animations cannot run in
// Jest (a delayed start can fire after teardown), and every screen must be complete without
// motion anyway.
jest
  .spyOn(jest.requireActual('react-native').AccessibilityInfo, 'isReduceMotionEnabled')
  .mockResolvedValue(true);

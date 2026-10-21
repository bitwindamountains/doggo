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

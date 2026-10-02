import type { ConfigContext, ExpoConfig } from 'expo/config';

// Secrets come from EAS environment variables or a local .env (never committed).
// See docs/ARCHITECTURE.md §8. All of them are optional until their milestone.
const env = {
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  REVENUECAT_IOS_KEY: process.env.REVENUECAT_IOS_KEY,
  REVENUECAT_ANDROID_KEY: process.env.REVENUECAT_ANDROID_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  POSTHOG_KEY: process.env.POSTHOG_KEY,
};

// Placeholder until the name is final; keep in sync with docs/ARCHITECTURE.md §8.
const BUNDLE_ID = 'app.dogyears';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dog Years',
  slug: 'dog-years',
  version: '0.1.0',
  scheme: 'dogyears',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    ...(env.APPLE_TEAM_ID ? { appleTeamId: env.APPLE_TEAM_ID } : {}),
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#FFF7EC',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    [
      'expo-splash-screen',
      { image: './assets/images/splash-icon.png', imageWidth: 200, backgroundColor: '#FFF7EC' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    revenueCatIosKey: env.REVENUECAT_IOS_KEY ?? null,
    revenueCatAndroidKey: env.REVENUECAT_ANDROID_KEY ?? null,
    supabaseUrl: env.SUPABASE_URL ?? null,
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? null,
    posthogKey: env.POSTHOG_KEY ?? null,
  },
});

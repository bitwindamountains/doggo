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
const APP_GROUP = 'group.app.dogyears.shared';

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
    // Health Connect step reads (ARCHITECTURE §4.4). The library's plugin adds only the
    // privacy-rationale intent; the permission itself is declared here.
    permissions: ['android.permission.health.READ_STEPS'],
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-sqlite',
    // shortcut: no custom monochrome notification icon yet (Android falls back to the app
    // icon); add a 96x96 white-on-transparent PNG as `icon` before release.
    ['expo-notifications', { color: '#E07A3F' }],
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Dog Years reads your step count so your dog knows when you have walked. Steps stay on this phone.',
        NSHealthUpdateUsageDescription: false, // read only
        background: true, // hourly step delivery
      },
    ],
    'react-native-health-connect',
    // Health Connect needs Android 8.0+ (minSdk 26); Expo SDK 57 needs iOS 16.4+.
    [
      'expo-build-properties',
      { android: { minSdkVersion: 26 }, ios: { deploymentTarget: '16.4' } },
    ],
    // Screen Time extensions need the Apple team and App Group (ARCHITECTURE §4.2); the
    // plugin is only added once APPLE_TEAM_ID is set, so prebuild works before that.
    ...(env.APPLE_TEAM_ID
      ? [
          [
            'react-native-device-activity',
            { appleTeamId: env.APPLE_TEAM_ID, appGroup: APP_GROUP },
          ] as [string, Record<string, string>],
        ]
      : []),
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

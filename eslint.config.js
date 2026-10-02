// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'dog-years-blueprint/*', 'coverage/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // The dog engine is pure (CLAUDE.md, engineering rule 1): no platform, data or service
  // imports and no implicit clock.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-native', 'react-native/*', 'react-native-*'],
              message: 'src/engine must stay pure: no React or React Native.',
            },
            {
              group: ['expo', 'expo-*', 'expo/*', '@expo/*'],
              message: 'src/engine must stay pure: no Expo.',
            },
            {
              group: ['drizzle-orm', 'drizzle-orm/*'],
              message: 'src/engine must stay pure: no database.',
            },
            {
              group: ['@/data', '@/data/*', '@/services', '@/services/*', '**/data/*', '**/services/*'],
              message: 'src/engine must stay pure: pass data in through EngineInput.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'src/engine must not read the clock. Use input.now.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'src/engine must not read the clock. Use input.now.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'src/engine must be deterministic. Use a seeded generator.',
        },
      ],
    },
  },
]);

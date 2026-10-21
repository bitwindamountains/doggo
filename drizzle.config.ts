// drizzle-kit config: `npx drizzle-kit generate` writes SQL migrations plus a
// migrations.js bundle that the app imports (the `expo` driver inlines the .sql files).
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/data/schema.ts',
  out: './src/data/migrations',
});

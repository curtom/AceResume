import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

export default defineConfig({
  dialect: 'postgresql',
  schema: './apps/api/src/infrastructure/schema.ts',
  out: './infrastructure/migrations',
  dbCredentials: { url: process.env.DATABASE_URL },
});

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    include: ['tests/**/*.spec.ts'],
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3000/api/v1' },
  },
});

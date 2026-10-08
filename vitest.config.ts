import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Node exposes a partial `localStorage` global that lacks `clear`, so the
    // persistence tests get a real in-memory Storage instead.
    setupFiles: ['src/test/setup.ts'],
  },
});

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    pool: 'forks', // Important for e2e tests that share DB state
    poolOptions: {
      forks: {
        singleFork: true, // Run e2e tests sequentially
      },
    },
    coverage: {
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

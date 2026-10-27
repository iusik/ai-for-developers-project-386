import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'apps/api/src/server.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/test/**',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});

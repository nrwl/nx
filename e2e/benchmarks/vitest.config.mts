import { defineConfig } from 'vitest/config';
import codspeedPlugin from '@codspeed/vitest-plugin';
import { join } from 'node:path';

export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['../utils/benchmark-setup.ts'],
    hookTimeout: 60 * 60 * 1000, // 1 hour
  },
  benchmark: {},
} as any);

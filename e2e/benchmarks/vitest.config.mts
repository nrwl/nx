import { defineConfig } from 'vitest/config';
import codspeedPlugin from '@codspeed/vitest-plugin';

export default defineConfig({
  plugins: [codspeedPlugin() as any],
  test: {
    globals: true,
    environment: 'node',
  },
});

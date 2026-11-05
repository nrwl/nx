import type { ConfigFileNamePatterns } from '@nx/devkit/internal';

export const vitestConfigFileNamePatterns: ConfigFileNamePatterns = {
  defaultName: /^(vite|vitest)\.config\.(js|ts|mjs|mts|cjs|cts)$/,
  mappableName: /^(vite|vitest)\.config.*\.(js|ts|mjs|mts|cjs|cts)$/,
  mappableGlob: '{vite,vitest}.config*.{js,ts,mjs,mts,cjs,cts}',
};

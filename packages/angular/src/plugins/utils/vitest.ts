import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

// https://github.com/angular/angular-cli/blob/03b86fe28e34c489b91858614236dd14e2cb9985/packages/angular/build/src/builders/unit-test/runners/vitest/configuration.ts#L17-L28
const VITEST_CONFIG_FILES = [
  'vitest-base.config.ts',
  'vitest-base.config.mts',
  'vitest-base.config.cts',
  'vitest-base.config.js',
  'vitest-base.config.mjs',
  'vitest-base.config.cjs',
];

export function loadVite(): Promise<typeof import('vite')> {
  return Function('return import("vite")')() as Promise<typeof import('vite')>;
}

export async function findVitestBaseConfig(
  searchDirs: string[]
): Promise<string | false> {
  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = new Set(
        entries.filter((e) => e.isFile()).map((e) => e.name)
      );
      for (const configFile of VITEST_CONFIG_FILES) {
        if (files.has(configFile)) {
          return join(dir, configFile);
        }
      }
    } catch {
      // Ignore directories that cannot be read
    }
  }
  return false;
}

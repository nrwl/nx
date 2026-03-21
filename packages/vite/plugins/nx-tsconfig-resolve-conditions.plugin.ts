import { workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Plugin } from 'vite';

/**
 * Reads `customConditions` from `tsconfig.base.json` and adds them to
 * Vite's `resolve.conditions` so that Vite can resolve package exports
 * that use those conditions (e.g. the TypeScript source condition used
 * in TS solution setups).
 */
export function nxTsconfigResolveConditionsPlugin(): Plugin {
  return {
    name: 'nx-tsconfig-resolve-conditions',
    config() {
      const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json');
      if (!existsSync(tsconfigPath)) {
        return;
      }

      try {
        const tsconfigContent = readFileSync(tsconfigPath, 'utf-8');
        // Strip single-line and block comments for JSON parsing
        const stripped = tsconfigContent
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        const tsconfig = JSON.parse(stripped);
        const customConditions: string[] =
          tsconfig.compilerOptions?.customConditions;

        if (customConditions?.length) {
          return {
            resolve: {
              conditions: customConditions,
            },
          };
        }
      } catch {
        // Silently ignore parse errors — the config may be malformed
        // but that's not this plugin's problem to report.
      }
    },
  };
}

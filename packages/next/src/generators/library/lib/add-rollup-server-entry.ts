import { joinPathFragments, Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalize-options';

/**
 * Adds the server entry (`src/server.ts`, or `src/server.js` with `--js`) as a
 * second Rollup entry so React Server Components are bundled separately from
 * the client entry.
 */
export function addRollupServerEntry(
  tree: Tree,
  options: NormalizedSchema
): void {
  const serverEntry = `src/server.${options.js ? 'js' : 'ts'}`;

  const rollupConfigPath = joinPathFragments(
    options.projectRoot,
    'rollup.config.cjs'
  );
  if (!tree.exists(rollupConfigPath)) {
    throw new Error(
      `Could not add the server entry: ${rollupConfigPath} not found.`
    );
  }
  const content = tree.read(rollupConfigPath, 'utf-8');
  const updated = content.replace(
    /^(\s*)main: .*\n/m,
    (line, indent) =>
      line + `${indent}additionalEntryPoints: ['./${serverEntry}'],\n`
  );
  if (updated === content) {
    throw new Error(
      `Could not add the server entry to ${rollupConfigPath}: "main" option not found.`
    );
  }
  tree.write(rollupConfigPath, updated);
}

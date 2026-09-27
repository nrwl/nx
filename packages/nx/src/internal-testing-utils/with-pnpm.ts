import type { Tree } from '../generators/tree';
import { updateJson } from '../generators/utils/json';
import { withEnvironmentVariables } from './with-environment';

/**
 * Runs `callback` with the workspace presented as managed by the given pnpm
 * version: `packageManager` is written to the tree's package.json and a
 * matching `npm_config_user_agent` is set for the duration of the call, which
 * is what `detectPackageManager` reads for a tree that has no lock file on
 * disk.
 */
export function withPnpm<T>(tree: Tree, version: string, callback: () => T): T {
  updateJson(tree, 'package.json', (json) => ({
    ...json,
    packageManager: `pnpm@${version}`,
  }));

  return withEnvironmentVariables(
    { npm_config_user_agent: `pnpm/${version} npm/? node/v22.0.0` },
    callback
  );
}

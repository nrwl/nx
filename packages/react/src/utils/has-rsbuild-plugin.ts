import { ensurePackage, Tree } from '@nx/devkit';
import { nxVersion } from './versions';

export async function hasRsbuildPlugin(tree: Tree, projectPath?: string) {
  ensurePackage('@nx/rsbuild', nxVersion);
  // `require()` honors Module._initPaths (which ensurePackage updates); ESM
  // dynamic `import()` doesn't, so it can't see the on-demand temp install.
  const {
    hasRsbuildPlugin,
  }: typeof import('@nx/rsbuild/config-utils') = require('@nx/rsbuild/config-utils');
  return hasRsbuildPlugin(tree, projectPath);
}

import { ensurePackage, Tree } from '@nx/devkit';
import { nxVersion } from './versions';

export async function hasRsbuildPlugin(tree: Tree, projectPath?: string) {
  ensurePackage('@nx/rsbuild', nxVersion);
  const { hasRsbuildPlugin } = await import('@nx/rsbuild/config-utils');
  return hasRsbuildPlugin(tree, projectPath);
}

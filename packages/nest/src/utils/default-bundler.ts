import type { Tree } from '@nx/devkit';
import { major } from 'semver';
import { getInstalledNestJsVersion } from './versions';

// NestJS v12 recommends Rspack over Webpack; v10/v11 workspaces keep the
// existing Webpack default so nothing changes under them.
export function getDefaultBundler(tree: Tree): 'rspack' | 'webpack' {
  const installed = getInstalledNestJsVersion(tree);
  return installed && major(installed) >= 12 ? 'rspack' : 'webpack';
}

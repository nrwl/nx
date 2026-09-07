import type { Tree } from '@nx/devkit';
import { major } from 'semver';
import { getInstalledNestJsVersion } from './versions';

// NestJS v12 recommends Vitest over Jest; v10/v11 workspaces keep the
// existing Jest default so nothing changes under them.
export function getDefaultUnitTestRunner(tree: Tree): 'jest' | 'vitest' {
  const installed = getInstalledNestJsVersion(tree);
  return installed && major(installed) >= 12 ? 'vitest' : 'jest';
}

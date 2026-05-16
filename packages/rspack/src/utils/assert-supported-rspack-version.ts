import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedRspackVersion } from './versions';

export function assertSupportedRspackVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@rspack/core',
    minSupportedRspackVersion
  );
}

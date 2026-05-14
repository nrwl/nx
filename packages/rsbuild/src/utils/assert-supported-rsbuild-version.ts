import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedRsbuildVersion } from './versions';

export function assertSupportedRsbuildVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@rsbuild/core',
    minSupportedRsbuildVersion
  );
}

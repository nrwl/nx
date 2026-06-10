import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedNextVersion } from './versions';

export function assertSupportedNextVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'next', minSupportedNextVersion);
}

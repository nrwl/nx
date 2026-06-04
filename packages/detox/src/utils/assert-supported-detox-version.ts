import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedDetoxVersion } from './versions';

export function assertSupportedDetoxVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'detox', minSupportedDetoxVersion);
}

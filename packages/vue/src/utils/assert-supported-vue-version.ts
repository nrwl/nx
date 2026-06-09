import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedVueVersion } from './versions';

export function assertSupportedVueVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'vue', minSupportedVueVersion);
}

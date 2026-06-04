import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedExpoVersion } from './versions';

export function assertSupportedExpoVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'expo', minSupportedExpoVersion);
}

import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedVitestVersion } from './versions';

export function assertSupportedVitestVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'vitest', minSupportedVitestVersion);
}

import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedEsbuildVersion } from './versions';

export function assertSupportedEsbuildVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'esbuild', minSupportedEsbuildVersion);
}

import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedViteVersion } from './versions';

export function assertSupportedViteVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'vite', minSupportedViteVersion);
}

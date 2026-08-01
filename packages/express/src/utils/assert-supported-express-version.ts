import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedExpressVersion } from './versions';

export function assertSupportedExpressVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'express', minSupportedExpressVersion);
}

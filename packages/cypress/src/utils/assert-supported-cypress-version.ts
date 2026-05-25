import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedCypressVersion } from './versions';

export function assertSupportedCypressVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'cypress', minSupportedCypressVersion);
}

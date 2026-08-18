import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedReactVersion } from './versions';

export function assertSupportedReactVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'react', minSupportedReactVersion);
}

import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedTypescriptVersion } from './versions';

export function assertSupportedTypescriptVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    'typescript',
    minSupportedTypescriptVersion
  );
}

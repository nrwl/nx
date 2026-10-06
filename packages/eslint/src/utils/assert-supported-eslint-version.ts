import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedEslintVersion } from './versions';

export function assertSupportedEslintVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'eslint', minSupportedEslintVersion);
}

import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedJestVersion, minSupportedTsJestVersion } from './versions';

export function assertSupportedJestVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'jest', minSupportedJestVersion);
  // ts-jest installs on an independent versioning train from jest, so its
  // floor is asserted separately.
  assertSupportedPackageVersion(tree, 'ts-jest', minSupportedTsJestVersion);
}

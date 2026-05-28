import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { warnEslintV8Deprecation } from './deprecation';
import {
  getInstalledEslintMajorVersion,
  minSupportedEslintVersion,
} from './versions';

export function assertSupportedEslintVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'eslint', minSupportedEslintVersion);
  if (getInstalledEslintMajorVersion(tree) === 8) {
    warnEslintV8Deprecation();
  }
}

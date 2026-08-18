import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedNestJsVersion } from './versions';

export function assertSupportedNestJsVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@nestjs/core',
    minSupportedNestJsVersion
  );
}

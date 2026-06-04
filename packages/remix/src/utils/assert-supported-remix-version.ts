import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedRemixVersion } from './versions';

export function assertSupportedRemixVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@remix-run/dev',
    minSupportedRemixVersion
  );
}

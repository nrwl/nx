import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export function assertSupportedRemixVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, '@remix-run/dev', '2.0.0');
}

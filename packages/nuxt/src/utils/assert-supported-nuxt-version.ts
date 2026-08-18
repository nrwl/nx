import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedNuxtVersion } from './versions';

export function assertSupportedNuxtVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'nuxt', minSupportedNuxtVersion);
}

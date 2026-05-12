import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedPlaywrightVersion } from './versions';

export function assertSupportedPlaywrightVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@playwright/test',
    minSupportedPlaywrightVersion
  );
}

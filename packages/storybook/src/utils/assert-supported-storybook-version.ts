import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedStorybookVersion } from './versions';

export function assertSupportedStorybookVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    'storybook',
    minSupportedStorybookVersion
  );
}

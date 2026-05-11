import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { supportedVersions } from './backward-compatible-versions';

const minSupportedAngularMajor = Math.min(...supportedVersions);

export function assertSupportedAngularVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@angular/core',
    `${minSupportedAngularMajor}.0.0`
  );
}

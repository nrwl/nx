import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { throwForUnsupportedVersion } from '@nx/devkit/internal';
import { clean, coerce, major } from 'semver';
import { supportedVersions } from './backward-compatible-versions';

const minSupportedAngularMajor = Math.min(...supportedVersions);

export function assertSupportedAngularVersion(tree: Tree): void {
  const detected = getDependencyVersionFromPackageJson(tree, '@angular/core');
  if (!detected || detected === 'latest' || detected === 'next') {
    return;
  }

  const cleaned = clean(detected) ?? coerce(detected)?.version ?? null;
  if (cleaned && major(cleaned) < minSupportedAngularMajor) {
    throwForUnsupportedVersion(
      '@angular/core',
      detected,
      `${minSupportedAngularMajor}.0.0`
    );
  }
}

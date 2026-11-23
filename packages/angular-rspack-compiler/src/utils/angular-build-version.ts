import { createRequire } from 'node:module';
import { coerce, gte } from 'semver';

/**
 * Whether the `@angular/build` this package loads `@angular/build/private`
 * from is at least `version`. Prereleases count as their release, since
 * private API changes land in them first.
 */
export function isAngularBuildVersionAtLeast(version: string): boolean {
  const { version: installedVersion } = createRequire(__filename)(
    '@angular/build/package.json'
  );
  const installed = coerce(installedVersion);
  if (!installed) {
    throw new TypeError(`Invalid Version: ${installedVersion}`);
  }
  return gte(installed, version);
}

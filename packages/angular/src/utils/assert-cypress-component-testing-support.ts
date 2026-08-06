import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getDeclaredPackageVersion } from '@nx/devkit/internal';
import { coerce, lt } from 'semver';

/**
 * Asserts the workspace's Cypress version can run Component Testing against its
 * Angular version. Must be called after `@nx/cypress` has been ensured.
 */
export function assertCypressComponentTestingSupport(tree: Tree): void {
  const angularVersion = getDeclaredPackageVersion(tree, '@angular/core');
  if (!angularVersion || lt(angularVersion, '22.1.0')) {
    return;
  }

  const {
    cypressVersion,
  }: typeof import('@nx/cypress/internal') = require('@nx/cypress/internal');
  // When Cypress is not installed, the generators install `cypressVersion`
  const declaredCypressVersion =
    getDependencyVersionFromPackageJson(tree, 'cypress') ?? cypressVersion;
  // A dist tag (`latest`, `next`) can't be compared, so it's not gated
  const installedCypressVersion = coerce(declaredCypressVersion)?.version;

  if (installedCypressVersion && lt(installedCypressVersion, '16.0.0')) {
    throw new Error(
      `Cypress Component Testing doesn't support Angular 22.1 and higher for Cypress version ${installedCypressVersion}. ` +
        `Angular 22.1 moved @angular-devkit/build-angular to Babel 8, which Cypress can't load. ` +
        `Cypress 16 should be the first release to support it. ` +
        `See https://github.com/cypress-io/cypress/issues/34461.`
    );
  }
}

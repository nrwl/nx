import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getDeclaredPackageVersion } from '@nx/devkit/internal';
import { lt, subset, validRange } from 'semver';

const minCypressVersion = '15.20.1';

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

  // Gate only ranges capped below the floor. `^15.17.0` installs 15.20.1+, so
  // comparing its lower bound would reject workspaces that work. Dist tags
  // (`latest`, `next`) aren't ranges and aren't gated.
  if (
    !validRange(declaredCypressVersion) ||
    !subset(declaredCypressVersion, `<${minCypressVersion}`)
  ) {
    return;
  }

  throw new Error(
    `Cypress Component Testing with Angular 22.1 and higher requires Cypress ${minCypressVersion} or higher. ` +
      `Found Cypress ${declaredCypressVersion}. Earlier Cypress versions can't load Angular's Babel 8 dependencies. ` +
      `Please upgrade Cypress. ` +
      `See https://github.com/cypress-io/cypress/issues/34461.`
  );
}

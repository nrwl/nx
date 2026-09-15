import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import {
  getResolvedPackageVersion,
  getSatisfyingInstalledPackageVersion,
} from '@nx/devkit/internal';
import { coerce, lt, subset, validRange } from 'semver';

const minCypressVersion = '15.20.1';

/**
 * Asserts the workspace's Cypress version can run Component Testing against its
 * Angular version. Must be called after `@nx/cypress` has been ensured.
 */
export function assertCypressComponentTestingSupport(tree: Tree): void {
  const angularVersion = getResolvedPackageVersion(tree, '@angular/core');
  if (!angularVersion) {
    return;
  }
  // A prerelease of 22.1 counts as 22.1.
  const angularRelease = coerce(angularVersion)?.version ?? angularVersion;
  if (lt(angularRelease, '22.1.0')) {
    return;
  }

  const found = findCypressBelow(tree, minCypressVersion);
  if (found) {
    throwForUnsupportedCypress(found);
  }
}

/**
 * Returns the installed Cypress version, or the declared range when nothing
 * satisfying is installed, if it cannot reach `floor`; `null` otherwise.
 *
 * A satisfying install decides. Without one, only a range capped below the
 * floor fails: `^15.17.0` installs 15.20.1+, so its lower bound cannot be
 * compared. Dist tags (`latest`, `next`) are not ranges and are not gated.
 * When Cypress is not declared, the generators install `cypressVersion`.
 */
export function findCypressBelow(tree: Tree, floor: string): string | null {
  const {
    cypressVersion,
  }: typeof import('@nx/cypress/internal') = require('@nx/cypress/internal');
  const declaredCypressVersion = getDependencyVersionFromPackageJson(
    tree,
    'cypress'
  );
  const installedCypressVersion = declaredCypressVersion
    ? getSatisfyingInstalledPackageVersion(
        tree,
        'cypress',
        declaredCypressVersion
      )
    : null;
  if (installedCypressVersion) {
    const release =
      coerce(installedCypressVersion)?.version ?? installedCypressVersion;
    return lt(release, floor) ? installedCypressVersion : null;
  }

  const range = declaredCypressVersion ?? cypressVersion;
  return validRange(range) && subset(range, `<${floor}`) ? range : null;
}

function throwForUnsupportedCypress(found: string): never {
  throw new Error(
    `Cypress Component Testing with Angular 22.1 and higher requires Cypress ${minCypressVersion} or higher. ` +
      `Found Cypress ${found}. Earlier Cypress versions can't load Angular's Babel 8 dependencies. ` +
      `Please upgrade Cypress. ` +
      `See https://github.com/cypress-io/cypress/issues/34461.`
  );
}

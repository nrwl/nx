import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';
import { satisfies } from 'semver';

describe('Cypress migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);

  describe('23.3.0-cypress-16 package update', () => {
    const update = (json as any).packageJsonUpdates['23.3.0-cypress-16'];
    const gatedMigrations = [
      'update-cypress-16-config-options',
      'update-cypress-16-query-command-overwrites',
      'update-angular-zoneless-mount-import',
      'create-ai-instructions-for-cypress-16',
    ];

    // Mirrors how nx gates an entry: every requirement must be satisfied by
    // the version the package lands on, prereleases included.
    const applies = (
      requires: Record<string, string>,
      installed: Record<string, string>
    ) =>
      Object.entries(requires).every(([pkg, range]) =>
        satisfies(installed[pkg], range, { includePrerelease: true })
      );

    it('should move Cypress 15 to 16 with the matching dev servers', () => {
      expect(update.packages).toEqual({
        cypress: { version: '^16.0.0', alwaysAddToPackageJson: false },
        '@cypress/vite-dev-server': {
          version: '^8.0.0',
          alwaysAddToPackageJson: false,
        },
        '@cypress/webpack-dev-server': {
          version: '^6.0.0',
          alwaysAddToPackageJson: false,
        },
      });
    });

    it.each(['15.0.0', '15.20.1', '15.99.0'])(
      'should apply to a workspace on Cypress %s',
      (cypress) => {
        expect(applies(update.requires, { cypress })).toBe(true);
      }
    );

    it.each(['14.5.0', '16.0.0'])(
      'should be a no-op for a workspace on Cypress %s',
      (cypress) => {
        expect(applies(update.requires, { cypress })).toBe(false);
      }
    );

    it.each(gatedMigrations)(
      'should schedule %s once the package update lands on Cypress 16',
      (name) => {
        const entry = (json as any).generators[name];

        expect(entry.version).toBe(update.version);
        expect(applies(entry.requires, { cypress: '16.0.0' })).toBe(true);
        expect(applies(entry.requires, { cypress: '15.20.1' })).toBe(false);
      }
    );
  });
});

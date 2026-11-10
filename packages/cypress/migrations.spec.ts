import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';
import { satisfies } from 'semver';

describe('Cypress migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);

  describe('Cypress 16 migrations', () => {
    const upgrade = (json as any).generators['upgrade-to-cypress-16'];
    const landingMigrations = [
      'update-cypress-16-config-options',
      'update-cypress-16-query-command-overwrites',
      'update-angular-zoneless-mount-import',
      'create-ai-instructions-for-cypress-16',
    ];

    // Mirrors `Migrator.areRequirementsMet` in
    // packages/nx/src/command-line/migrate/migrate.ts: every requirement must
    // be satisfied by the version the package lands on, prereleases included,
    // and an absent package fails it. `versions` holds those landing versions:
    // a pending update's version, otherwise what resolves from the root
    // node_modules, so a hoisted transitive package counts.
    const applies = (
      entry: { requires: Record<string, string> },
      versions: Record<string, string>
    ) =>
      Object.entries(entry.requires).every(
        ([pkg, range]) =>
          !!versions[pkg] &&
          satisfies(versions[pkg], range, { includePrerelease: true })
      );

    it('should bump Cypress 15 to 16 through a migration, not a package update', () => {
      expect((json as any).packageJsonUpdates['23.3.0-cypress-16']).toBe(
        undefined
      );
      expect(upgrade.implementation).toBe(
        './dist/src/migrations/update-23-3-0/upgrade-to-cypress-16'
      );
      expect(upgrade.prompt).toBe(
        './dist/src/migrations/update-23-3-0/ai-instructions-for-cypress-16.md'
      );
    });

    it.each(['15.0.0', '15.20.1', '15.99.0'])(
      'should schedule the upgrade for a workspace on Cypress %s, whatever Vite resolves',
      (cypress) => {
        expect(applies(upgrade, { cypress, vite: '7.3.2' })).toBe(true);
      }
    );

    it.each(['14.5.0', '16.0.0'])(
      'should not schedule the upgrade for a workspace on Cypress %s',
      (cypress) => {
        expect(applies(upgrade, { cypress })).toBe(false);
      }
    );

    // The upgrade migration runs these rewrites itself, so they only need to
    // be scheduled for workspaces that land on Cypress 16 another way.
    it.each(landingMigrations)(
      'should schedule %s only for a workspace landing on Cypress 16',
      (name) => {
        const entry = (json as any).generators[name];

        expect(applies(entry, { cypress: '16.0.0' })).toBe(true);
        expect(applies(entry, { cypress: '15.20.1' })).toBe(false);
      }
    );
  });
});

import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';
import { satisfies } from 'semver';

describe('Cypress migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);

  describe('Cypress 16 package updates', () => {
    const update = (json as any).packageJsonUpdates['23.3.0-cypress-16'];
    const gatedMigrations = [
      'update-cypress-16-config-options',
      'update-cypress-16-query-command-overwrites',
      'update-angular-zoneless-mount-import',
      'create-ai-instructions-for-cypress-16',
    ];
    const cypress16 = { version: '^16.0.0', alwaysAddToPackageJson: false };
    const viteDevServer8 = { version: '^8.0.0', alwaysAddToPackageJson: false };
    const webpackDevServer6 = {
      version: '^6.0.0',
      alwaysAddToPackageJson: false,
    };

    // Mirrors `Migrator.areRequirementsMet` and
    // `areIncompatiblePackagesPresent` in
    // packages/nx/src/command-line/migrate/migrate.ts: every requirement must
    // be satisfied by the version the package lands on, prereleases included,
    // and no incompatibility may be. An absent package fails a requirement and
    // matches no incompatibility. `versions` holds those landing versions: a
    // pending update's version, otherwise what resolves from the root
    // node_modules, so a hoisted transitive package counts.
    const satisfied = (
      ranges: Record<string, string>,
      versions: Record<string, string>,
      pkg: string
    ) =>
      !!versions[pkg] &&
      satisfies(versions[pkg], ranges[pkg], { includePrerelease: true });
    const applies = (
      group: {
        requires: Record<string, string>;
        incompatibleWith?: Record<string, string>;
      },
      versions: Record<string, string>
    ) =>
      Object.keys(group.requires).every((pkg) =>
        satisfied(group.requires, versions, pkg)
      ) &&
      !Object.keys(group.incompatibleWith ?? {}).some((pkg) =>
        satisfied(group.incompatibleWith, versions, pkg)
      );

    it('should move Cypress 15 to 16 with the matching dev servers', () => {
      expect(update.packages).toEqual({
        cypress: cypress16,
        '@cypress/vite-dev-server': viteDevServer8,
        '@cypress/webpack-dev-server': webpackDevServer6,
      });
    });

    it.each(['15.0.0', '15.20.1', '15.99.0'])(
      'should apply to a workspace on Cypress %s without Vite',
      (cypress) => {
        expect(applies(update, { cypress })).toBe(true);
      }
    );

    it.each(['14.5.0', '16.0.0'])(
      'should be a no-op for a workspace on Cypress %s',
      (cypress) => {
        expect(applies(update, { cypress })).toBe(false);
      }
    );

    it.each([
      [
        'vite component testing on Vite 8',
        { '@cypress/vite-dev-server': '7.3.4', vite: '8.0.0' },
      ],
      [
        'vite component testing without a resolvable Vite',
        { '@cypress/vite-dev-server': '7.3.4' },
      ],
      [
        'a vite dev server outside 7.x on Vite 8',
        { '@cypress/vite-dev-server': '6.0.3', vite: '8.0.0' },
      ],
      [
        'webpack component testing without Vite',
        { '@cypress/webpack-dev-server': '5.4.1' },
      ],
    ])('should apply to a workspace with %s', (_, packages) => {
      expect(applies(update, { cypress: '15.20.1', ...packages })).toBe(true);
    });

    // Vite component testing generated before 23.3 has no
    // `@cypress/vite-dev-server` (the React generator installed the webpack dev
    // server instead), so the group cannot tell it from e2e or webpack
    // component testing and holds every workspace that resolves an older Vite.
    it.each([
      [
        'vite component testing generated before 23.3',
        { '@cypress/webpack-dev-server': '5.4.1', vite: '7.1.0' },
      ],
      [
        'vite component testing',
        { '@cypress/vite-dev-server': '7.3.4', vite: '7.3.6' },
      ],
      ['e2e only and a hoisted transitive Vite', { vite: '7.1.0' }],
    ])(
      'should keep a workspace with %s on Cypress 15 while it stays on a Vite below 8',
      (_, packages) => {
        expect(applies(update, { cypress: '15.20.1', ...packages })).toBe(
          false
        );
      }
    );

    it.each(['5.4.0', '6.3.0', '7.3.6', '8.0.0-beta.1'])(
      'should treat Vite %s as below 8',
      (vite) => {
        expect(applies(update, { cypress: '15.20.1', vite })).toBe(false);
      }
    );

    it.each(gatedMigrations)(
      'should schedule %s once the package update lands on Cypress 16',
      (name) => {
        const entry = (json as any).generators[name];

        expect(entry.version).toBe(update.version);
        expect(applies(entry, { cypress: '16.0.0' })).toBe(true);
        expect(applies(entry, { cypress: '15.20.1' })).toBe(false);
      }
    );
  });
});

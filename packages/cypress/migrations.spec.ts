import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';
import { satisfies } from 'semver';

describe('Cypress migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);

  describe('Cypress 16 package updates', () => {
    const update = (json as any).packageJsonUpdates['23.3.0-cypress-16'];
    const viteUpdate = (json as any).packageJsonUpdates[
      '23.3.0-cypress-16-vite'
    ];
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

    // Mirrors how nx gates a group: every requirement must be satisfied by
    // the version the package lands on, prereleases included, and no
    // incompatibility may be. An absent package fails a requirement and
    // matches no incompatibility.
    const satisfied = (
      ranges: Record<string, string>,
      installed: Record<string, string>,
      pkg: string
    ) =>
      !!installed[pkg] &&
      satisfies(installed[pkg], ranges[pkg], { includePrerelease: true });
    const applies = (
      group: {
        requires: Record<string, string>;
        incompatibleWith?: Record<string, string>;
      },
      installed: Record<string, string>
    ) =>
      Object.keys(group.requires).every((pkg) =>
        satisfied(group.requires, installed, pkg)
      ) &&
      !Object.keys(group.incompatibleWith ?? {}).some((pkg) =>
        satisfied(group.incompatibleWith, installed, pkg)
      );

    it('should move Cypress 15 to 16 with the matching dev servers', () => {
      expect(update.packages).toEqual({
        cypress: cypress16,
        '@cypress/webpack-dev-server': webpackDevServer6,
      });
      expect(viteUpdate.packages).toEqual({
        cypress: cypress16,
        '@cypress/vite-dev-server': viteDevServer8,
        '@cypress/webpack-dev-server': webpackDevServer6,
      });
      expect(viteUpdate.version).toBe(update.version);
    });

    it.each(['15.0.0', '15.20.1', '15.99.0'])(
      'should apply to a workspace on Cypress %s without vite component testing',
      (cypress) => {
        expect(applies(update, { cypress })).toBe(true);
        expect(applies(viteUpdate, { cypress })).toBe(false);
      }
    );

    it.each(['14.5.0', '16.0.0'])(
      'should be a no-op for a workspace on Cypress %s',
      (cypress) => {
        const installed = { cypress, '@cypress/vite-dev-server': '7.3.4' };

        expect(applies(update, { cypress })).toBe(false);
        expect(applies(viteUpdate, installed)).toBe(false);
      }
    );

    it.each([
      ['lands on Vite 8', '8.0.0'],
      ['has no Vite', undefined],
    ])(
      'should apply to a workspace with vite component testing that %s',
      (_, vite) => {
        const installed = {
          cypress: '15.20.1',
          '@cypress/vite-dev-server': '7.3.4',
          ...(vite ? { vite } : {}),
        };

        expect(applies(viteUpdate, installed)).toBe(true);
        expect(applies(update, installed)).toBe(false);
      }
    );

    it.each(['5.4.0', '6.3.0', '7.3.6', '8.0.0-beta.1'])(
      'should keep a workspace with vite component testing on Cypress 15 when it stays on Vite %s',
      (vite) => {
        const installed = {
          cypress: '15.20.1',
          '@cypress/vite-dev-server': '7.3.4',
          vite,
        };

        expect(applies(viteUpdate, installed)).toBe(false);
        expect(applies(update, installed)).toBe(false);
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

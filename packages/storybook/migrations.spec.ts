import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';
import { satisfies } from 'semver';

describe('storybook migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);

  describe('23.2.0-test-runner package update', () => {
    const entry = (json as any).packageJsonUpdates['23.2.0-test-runner'];

    // Mirrors how nx gates a packageJsonUpdates entry: every requirement must
    // be satisfied by the installed version.
    const applies = (installed: Record<string, string>) =>
      Object.entries(entry.requires).every(([pkg, range]) =>
        satisfies(installed[pkg], range as string, { includePrerelease: true })
      );

    it('should bump the test runner to the line that peers storybook 10', () => {
      expect(entry.packages['@storybook/test-runner']).toEqual({
        version: '^0.24.0',
        alwaysAddToPackageJson: false,
      });
    });

    it('should apply to a storybook 10 workspace on an older runner', () => {
      expect(
        applies({ storybook: '10.5.0', '@storybook/test-runner': '0.21.0' })
      ).toBe(true);
    });

    it.each`
      case                        | installed
      ${'runner already current'} | ${{ storybook: '10.5.0', '@storybook/test-runner': '0.24.4' }}
      ${'storybook 9'}            | ${{ storybook: '9.1.0', '@storybook/test-runner': '0.21.0' }}
      ${'storybook 11'}           | ${{ storybook: '11.0.0', '@storybook/test-runner': '0.21.0' }}
    `('should be a no-op when $case', ({ installed }) => {
      expect(applies(installed)).toBe(false);
    });
  });
});

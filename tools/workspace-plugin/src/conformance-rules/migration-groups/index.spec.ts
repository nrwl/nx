const mockExistsSync = jest.fn();
jest.mock('node:fs', () => {
  return {
    ...jest.requireActual('node:fs'),
    existsSync: mockExistsSync,
  };
});

import { validateMigrations } from './index';

describe('migration-groups', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  // Unit test the core implementation details of validating the project package.json
  describe('validateMigrations()', () => {
    it('should return no violations when migrations do not include packageJsonUpdates', () => {
      const migrations = {};
      const sourceProject = 'test-project';
      const sourceProjectRoot = '/path/to/test-project';
      const violations = validateMigrations(
        migrations,
        sourceProject,
        `${sourceProjectRoot}/migrations.json`,
        { groups: [['@acme/foo', '@acme/bar']] }
      );
      expect(violations).toHaveLength(0);
    });

    it('should return no violations for a valid packageJsonUpdates', () => {
      const migrations = {
        packageJsonUpdates: {
          '0.0.1': {
            version: '0.0.1',
            packages: {
              '@acme/foo': {
                version: '1.0.0',
              },
              '@acme/bar': {
                version: '1.0.0',
              },
            },
          },
        },
      };
      const sourceProject = 'test-project';
      const sourceProjectRoot = '/path/to/test-project';
      const violations = validateMigrations(
        migrations,
        sourceProject,
        `${sourceProjectRoot}/migrations.json`,
        { groups: [['@acme/foo', '@acme/bar']] }
      );
      expect(violations).toHaveLength(0);
    });

    it('should return violations for missing packages in a group', () => {
      const migrations = {
        packageJsonUpdates: {
          '0.0.1': {
            version: '0.0.1',
            packages: {
              '@acme/foo': {
                version: '1.0.0',
              },
            },
          },
        },
      };
      const sourceProject = 'test-project';
      const sourceProjectRoot = '/path/to/test-project';
      const violations = validateMigrations(
        migrations,
        sourceProject,
        `${sourceProjectRoot}/migrations.json`,
        { groups: [['@acme/foo', '@acme/bar']] }
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/migrations.json",
            "message": "Package.json updates for "0.0.1" is missing packages in a group: @acme/bar. Versions of packages in a group must have their versions synced. Version: 1.0.0.
                    ",
            "sourceProject": "test-project",
          },
        ]
      `);
    });

    it('should return violations for mismatched versions for packages in a group', () => {
      const migrations = {
        packageJsonUpdates: {
          '0.0.1': {
            version: '0.0.1',
            packages: {
              '@acme/foo': {
                version: '1.0.0',
              },
              '@acme/bar': {
                version: '~1.0.0',
              },
            },
          },
        },
      };
      const sourceProject = 'test-project';
      const sourceProjectRoot = '/path/to/test-project';
      const violations = validateMigrations(
        migrations,
        sourceProject,
        `${sourceProjectRoot}/migrations.json`,
        { groups: [['@acme/foo', '@acme/bar']] }
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/migrations.json",
            "message": "Package.json updates for "0.0.1" has mismatched versions in a package group: 1.0.0, ~1.0.0. Versions of packages in a group must be in sync. Packages in the group: @acme/foo, @acme/bar",
            "sourceProject": "test-project",
          },
        ]
      `);
    });

    it('should ignore migrations not matching versionRange', () => {
      const migrations = {
        packageJsonUpdates: {
          '0.0.1': {
            version: '0.0.1',
            packages: {
              '@acme/foo': {
                version: '1.0.0',
              },
            },
          },
          '1.0.0': {
            version: '1.0.0',
            packages: {
              '@acme/foo': {
                version: '1.0.0',
              },
              '@acme/bar': {
                version: '1.0.0',
              },
            },
          },
        },
      };
      const sourceProject = 'test-project';
      const sourceProjectRoot = '/path/to/test-project';
      const violations = validateMigrations(
        migrations,
        sourceProject,
        `${sourceProjectRoot}/migrations.json`,
        { groups: [['@acme/foo', '@acme/bar']], versionRange: '>= 1' }
      );
      expect(violations).toHaveLength(0);
    });
  });
});

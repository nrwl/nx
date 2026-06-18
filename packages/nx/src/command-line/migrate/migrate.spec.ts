const mocks = {
  prompt: jest.fn(),
  getInstalledNxVersion: jest.fn(),
  getInstalledVersion: jest.fn(),
  getInstalledPackageGroup: jest.fn(),
  getInstalledLegacyNrwlWorkspaceVersion: jest.fn(),
};
const mockPrompt = mocks.prompt;
const mockGetInstalledNxVersion = mocks.getInstalledNxVersion;
const mockGetInstalledVersion = mocks.getInstalledVersion;
const mockGetInstalledPackageGroup = mocks.getInstalledPackageGroup;
const mockGetInstalledLegacyNrwlWorkspaceVersion =
  mocks.getInstalledLegacyNrwlWorkspaceVersion;
jest.mock('enquirer', () => ({
  prompt: (...args: any[]) => mocks.prompt(...args),
}));
jest.mock('../../utils/installed-nx-version', () => ({
  getInstalledNxVersion: () => mocks.getInstalledNxVersion(),
  getInstalledVersion: (pkg: string) => mocks.getInstalledVersion(pkg),
  getInstalledPackageGroup: (pkg: string) =>
    mocks.getInstalledPackageGroup(pkg),
  getInstalledLegacyNrwlWorkspaceVersion: () =>
    mocks.getInstalledLegacyNrwlWorkspaceVersion(),
}));
// These tests exercise the migrate logic, not the cooldown wrapper: delegate the
// policy-aware resolver to the legacy registry resolution so the existing
// `resolvePackageVersionUsingRegistry` spies keep driving the assertions.
jest.mock('./resolve-package-version', () => ({
  isRegistryResolutionEnabled: () => true,
  resolvePackageVersionRespectingMinReleaseAge: (
    packageName: string,
    version: string
  ) =>
    require('../../utils/package-manager').resolvePackageVersionUsingRegistry(
      packageName,
      version
    ),
}));
import { resolveCatalogSpecifiers } from '../../utils/catalog';
import { PackageJson } from '../../utils/package-json';
import * as packageMgrUtils from '../../utils/package-manager';

import {
  createFetcher,
  filterDowngradedUpdates,
  formatCommandFailure,
  formatSkippedPromptsNextStep,
  isHybridMigration,
  isNpmPeerDepsError,
  isPromptOnlyMigration,
  Migrator,
  normalizeVersion,
  parseMigrationReturn,
  parseMigrationsOptions,
  ResolvedMigrationConfiguration,
  resolveCanonicalNxPackage,
  resolveCreateCommits,
  resolveDocumentationFileToWorkspacePath,
  resolveMigrationForRun,
  resolveInclude,
} from './migrate';
import { applyNxJsonMigrateDefaults } from './migrate-config';
import { MinReleaseAgeViolationError } from '../../utils/min-release-age/errors';
import {
  readPromptFilesFromInstall,
  validateMigrationEntries,
  writePromptMigrationFiles,
} from './prompt-files';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { logger } from '../../utils/logger';

const createPackageJson = (
  overrides: Partial<PackageJson> = {}
): PackageJson => ({
  name: 'some-workspace',
  version: '0.0.0',
  ...overrides,
});

// Stub fetcher driving the `--include` supportsOptionalMigrations gate without the
// registry/install round-trip. `supportsOptionalMigrations` defaults to true; pass a
// predicate to mark specific (package, version) targets unsupported.
const includeGateFetch =
  (
    supportsOptionalMigrations:
      | boolean
      | ((pkg: string, version: string) => boolean) = true
  ): ((
    pkg: string,
    version: string
  ) => Promise<ResolvedMigrationConfiguration>) =>
  (pkg, version) =>
    Promise.resolve({
      name: pkg,
      version,
      supportsOptionalMigrations:
        typeof supportsOptionalMigrations === 'function'
          ? supportsOptionalMigrations(pkg, version)
          : supportsOptionalMigrations,
    });

describe('Migration', () => {
  describe('packageJson patch', () => {
    it('should throw an error when the target package is not available', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: () => '1.0',
        fetch: (_p, _v) => {
          throw new Error('cannot fetch');
        },
        from: {},
        to: {},
      });

      await expect(migrator.migrate('mypackage', 'myversion')).rejects.toThrow(
        /cannot fetch/
      );
    });

    it('should fail fast when a fetched migration config is missing a version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () => Promise.resolve({} as ResolvedMigrationConfiguration),
        from: {},
        to: {},
      });

      await expect(migrator.migrate('mypackage', '2.0.0')).rejects.toThrow(
        'Fetched migration metadata for mypackage is invalid: the target version is missing.'
      );
    });

    it('should return a patch to the new version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (_p, _v) => Promise.resolve({ version: '2.0.0' }),
        from: {},
        to: {},
      });

      expect(await migrator.migrate('mypackage', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          mypackage: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should collect the information recursively from upserts', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                    newChild: {
                      version: '3.0.0',
                      addToPackageJson: 'devDependencies',
                    },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child') {
            return Promise.resolve({ version: '2.0.0' });
          } else if (p === 'newChild') {
            return Promise.resolve({ version: '2.0.0' });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
          newChild: { version: '2.0.0', addToPackageJson: 'devDependencies' },
        },
      });
    });

    it('should support the deprecated "alwaysAddToPackageJson" option', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child1: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'mypackage') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '3.0.0', alwaysAddToPackageJson: false },
                    child2: { version: '3.0.0', alwaysAddToPackageJson: true },
                  },
                },
              },
            });
          } else if (p === 'child1') {
            return Promise.resolve({ version: '3.0.0' });
          } else if (p === 'child2') {
            return Promise.resolve({ version: '3.0.0' });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('mypackage', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          mypackage: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '3.0.0', addToPackageJson: false },
          child2: { version: '3.0.0', addToPackageJson: 'dependencies' },
        },
      });
    });

    it('should support "alwaysAddToPackageJson" with string values', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child1: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'mypackage') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: {
                      version: '3.0.0',
                      alwaysAddToPackageJson: 'dependencies',
                    },
                    child2: {
                      version: '3.0.0',
                      alwaysAddToPackageJson: 'devDependencies',
                    },
                  },
                },
              },
            });
          } else if (p === 'child1') {
            return Promise.resolve({ version: '3.0.0' });
          } else if (p === 'child2') {
            return Promise.resolve({ version: '3.0.0' });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('mypackage', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          mypackage: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '3.0.0', addToPackageJson: 'dependencies' },
          child2: { version: '3.0.0', addToPackageJson: 'devDependencies' },
        },
      });
    });

    it('should stop recursive calls when exact version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    parent: { version: '2.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should set the version of a dependency to the newest', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            child1: '1.0.0',
            child2: '1.0.0',
            grandchild: '1.0.0',
          },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '2.0.0' },
                    child2: { version: '2.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child1') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    grandchild: { version: '3.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child2') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    grandchild: { version: '4.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else {
            return Promise.resolve({ version: '4.0.0' });
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '2.0.0', addToPackageJson: false },
          child2: { version: '2.0.0', addToPackageJson: false },
          grandchild: { version: '4.0.0', addToPackageJson: false },
        },
      });
    });

    it('should skip the versions < currently installed', async () => {
      const packageJson = {
        dependencies: { parent: '1.0.0', child: '2.0.0', grandchild: '3.0.0' },
      };
      const migrator = new Migrator({
        packageJson: createPackageJson(packageJson),
        getInstalledPackageVersion: (name) => {
          return packageJson.dependencies[name];
        },
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '1.0.0',
                  packages: {
                    grandchild: { version: '2.0.0' },
                  },
                },
              },
              schematics: {},
            });
          } else {
            return Promise.resolve({ version: '2.0.0' });
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should fail fast when an applied package update is missing a version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            parent: '1.0.0',
            child: '1.0.0',
          },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: undefined as any },
                  },
                },
              },
            });
          }

          return Promise.resolve({ version: '2.0.0' });
        },
        from: {},
        to: {},
      });

      await expect(migrator.migrate('parent', '2.0.0')).rejects.toThrow(
        'Fetched migration metadata for parent is invalid: the target version for child is missing.'
      );
    });

    it('should not fail for a skipped package update with a missing version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            parent: '1.0.0',
          },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  requires: {
                    other: '1.0.0',
                  },
                  packages: {
                    child: { version: undefined as any },
                  },
                },
              },
            });
          }

          return Promise.resolve({ version: '2.0.0' });
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should conditionally process packages if they are installed', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { child1: '1.0.0', child2: '1.0.0' },
        }),
        getInstalledPackageVersion: (p) =>
          p !== 'not-installed' ? '1.0.0' : null,
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '2.0.0', ifPackageInstalled: 'other' },
                    child2: {
                      version: '2.0.0',
                      ifPackageInstalled: 'not-installed',
                    },
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child1') {
            return Promise.resolve({ version: '2.0.0' });
          } else if (p === 'child2') {
            throw new Error('should not be processed');
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should migrate related libraries using packageGroup', async () => {
      const migrator = new Migrator({
        packageJson: {
          name: 'some-workspace',
          version: '0.0.0',

          devDependencies: {
            '@my-company/nx-workspace': '0.9.0',
            '@my-company/lib-1': '0.9.0',
            '@my-company/lib-2': '0.9.0',
            '@my-company/lib-3': '0.9.0',
            '@my-company/lib-3-child': '0.9.0',
            '@my-company/lib-4': '0.9.0',
            '@my-company/lib-5': '0.9.0',
            '@my-company/lib-6': '0.9.0',
          },
        },
        getInstalledPackageVersion: () => '1.0.0',
        fetch: async (pkg, version) => {
          if (pkg === '@my-company/nx-workspace') {
            return {
              version: '2.0.0',
              packageGroup: [
                { package: '@my-company/lib-1', version: '*' },
                { package: '@my-company/lib-2', version: '*' },
                { package: '@my-company/lib-3', version: '*' },
                { package: '@my-company/lib-4', version: 'latest' },
              ],
            };
          }
          if (pkg === '@my-company/lib-6') {
            return {
              version: '2.0.0',
              packageGroup: [
                { version: '*', package: '@my-company/nx-workspace' },
              ],
            };
          }
          if (pkg === '@my-company/lib-3') {
            return {
              version: '2.0.0',
              packageGroup: [
                { version: '*', package: '@my-company/lib-3-child' },
              ],
            };
          }
          if (version === 'latest') {
            return { version: '2.0.1' };
          }
          return { version: '2.0.0' };
        },
        from: {},
        to: {},
      });

      expect(
        await migrator.migrate('@my-company/nx-workspace', '2.0.0')
      ).toStrictEqual({
        migrations: [],
        packageUpdates: {
          '@my-company/nx-workspace': {
            version: '2.0.0',
            addToPackageJson: false,
          },
          '@my-company/lib-1': { version: '2.0.0', addToPackageJson: false },
          '@my-company/lib-2': { version: '2.0.0', addToPackageJson: false },
          '@my-company/lib-3': { version: '2.0.0', addToPackageJson: false },
          '@my-company/lib-3-child': {
            version: '2.0.0',
            addToPackageJson: false,
          },
          '@my-company/lib-4': { version: '2.0.1', addToPackageJson: false },
        },
        minVersionWithSkippedUpdates: undefined,
      });
    });

    it('should skip package group processing when ignorePackageGroup is true', async () => {
      const migrator = new Migrator({
        packageJson: {
          name: 'some-workspace',
          version: '0.0.0',
          devDependencies: {
            parent: '1.0.0',
            '@my-company/nx-workspace': '1.0.0',
            '@my-company/lib-1': '1.0.0',
            '@my-company/lib-2': '1.0.0',
          },
        },
        getInstalledPackageVersion: () => '1.0.0',
        fetch: async (pkg) => {
          if (pkg === 'parent') {
            return {
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    '@my-company/nx-workspace': {
                      version: '2.0.0',
                      ignorePackageGroup: true,
                    },
                  },
                },
              },
            };
          }
          if (pkg === '@my-company/nx-workspace') {
            return {
              version: '2.0.0',
              packageGroup: [
                { package: '@my-company/lib-1', version: '^2.0.0' },
                { package: '@my-company/lib-2', version: '^2.0.0' },
              ],
            };
          }
          return { version: '2.1.0' };
        },
        from: {},
        to: {},
      });

      const result = await migrator.migrate('parent', '2.0.0');

      // @my-company/nx-workspace should be updated but its package group should NOT be processed
      expect(result.packageUpdates).toStrictEqual({
        parent: { version: '2.0.0', addToPackageJson: false },
        '@my-company/nx-workspace': {
          version: '2.0.0',
          addToPackageJson: false,
        },
      });
      // lib-1 and lib-2 should NOT be in the updates because ignorePackageGroup was true
      expect(result.packageUpdates['@my-company/lib-1']).toBeUndefined();
      expect(result.packageUpdates['@my-company/lib-2']).toBeUndefined();
    });

    it('should skip migration collection when ignoreMigrations is true', async () => {
      const migrator = new Migrator({
        packageJson: {
          name: 'some-workspace',
          version: '0.0.0',
          devDependencies: {
            parent: '1.0.0',
            child: '1.0.0',
          },
        },
        getInstalledPackageVersion: () => '1.0.0',
        fetch: async (pkg) => {
          if (pkg === 'parent') {
            return {
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: {
                      version: '2.0.0',
                      ignoreMigrations: true,
                    },
                  },
                },
              },
            };
          }
          if (pkg === 'child') {
            return {
              version: '2.0.0',
              generators: {
                'child-migration': {
                  version: '2.0.0',
                  description: 'A migration that should be skipped',
                  factory: './migrations/child-migration',
                },
              },
            };
          }
          return { version: '2.0.0' };
        },
        from: {},
        to: {},
      });

      const result = await migrator.migrate('parent', '2.0.0');

      // child package should be updated
      expect(result.packageUpdates['child']).toBeDefined();
      expect(result.packageUpdates['child'].version).toBe('2.0.0');
      // But migrations from child should NOT be collected
      expect(result.migrations).toEqual([]);
    });

    it('should properly handle cyclic dependency in nested packageGroup', async () => {
      const migrator = new Migrator({
        packageJson: {
          name: 'some-workspace',
          version: '0.0.0',

          devDependencies: {
            '@my-company/nx-workspace': '0.9.0',
            '@my-company/lib-1': '0.9.0',
            '@my-company/lib-2': '0.9.0',
          },
        },
        getInstalledPackageVersion: () => '1.0.0',
        fetch: async (pkg, version) => {
          if (pkg === '@my-company/nx-workspace' && version === '2.0.0') {
            return {
              version: '2.0.0',
              packageGroup: [
                { package: '@my-company/lib-1', version: 'latest' },
              ],
            };
          }
          if (pkg === '@my-company/nx-workspace' && version === '3.0.0') {
            return {
              version: '3.0.0',
              packageGroup: [
                { package: '@my-company/lib-1', version: '*' },
                { package: '@my-company/lib-2', version: '*' },
              ],
            };
          }
          if (pkg === '@my-company/lib-1' && version === 'latest') {
            return {
              version: '3.0.0',
              packageGroup: [
                { package: '@my-company/nx-workspace', version: '*' },
              ],
            };
          }
          if (pkg === '@my-company/lib-1' && version === '3.0.0') {
            return {
              version: '3.0.0',
              packageGroup: [
                { package: '@my-company/nx-workspace', version: '*' },
              ],
            };
          }
          if (pkg === '@my-company/lib-2' && version === '3.0.0') {
            return {
              version: '3.0.0',
              packageGroup: [
                // this should be ignored because it's a smaller version
                { package: '@my-company/nx-workspace', version: '2.99.0' },
              ],
            };
          }
          throw new Error(`Should not call fetch for ${pkg}@${version}`);
        },
        from: {},
        to: {},
      });

      expect(
        await migrator.migrate('@my-company/nx-workspace', '2.0.0')
      ).toStrictEqual({
        migrations: [],
        packageUpdates: {
          '@my-company/nx-workspace': {
            version: '3.0.0',
            addToPackageJson: false,
          },
          '@my-company/lib-1': { version: '3.0.0', addToPackageJson: false },
          '@my-company/lib-2': { version: '3.0.0', addToPackageJson: false },
        },
        minVersionWithSkippedUpdates: undefined,
      });
    });

    it('should not throw when packages are missing', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: (p) => (p === '@nx/nest' ? null : '1.0.0'),
        fetch: (_p, _v) =>
          Promise.resolve({
            version: '2.0.0',
            packageJsonUpdates: { one: { version: '2.0.0', packages: {} } },
          }),
        from: {},
        to: {},
      });
      await migrator.migrate('@nx/workspace', '2.0.0');
    });

    it('should only fetch packages that are installed', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: (p) => (p === '@nx/nest' ? null : '1.0.0'),
        fetch: (p, _v) => {
          if (p === '@nx/nest') {
            throw new Error('Boom');
          }
          return Promise.resolve({
            version: '2.0.0',
            packageJsonUpdates: { one: { version: '2.0.0', packages: {} } },
          });
        },
        from: {},
        to: {},
      });
      await migrator.migrate('@nx/workspace', '2.0.0');
    });

    it('should only fetch packages that are top-level deps', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          devDependencies: { parent: '1.0.0', child1: '1.0.0' },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '2.0.0' },
                    child2: { version: '2.0.0' }, // should not be fetched, it's not a top-level dep
                  },
                },
              },
              schematics: {},
            });
          } else if (p === 'child1') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {},
            });
          } else if (p === 'child2') {
            throw new Error('Boom');
          }
        },
        from: {},
        to: {},
      });

      await migrator.migrate('parent', '2.0.0');
    });

    describe('--interactive', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should prompt when --interactive and there is a package updates group with confirmation prompts', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: true }));
        const promptMessage =
          'Do you want to update the packages related to <some fwk name>?';
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: { child1: '1.0.0', child2: '1.0.0', child3: '1.0.0' },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  version2: {
                    version: '2.0.0',
                    packages: {
                      child1: { version: '3.0.0' },
                    },
                  },
                  'version2-prompt-group': {
                    version: '2.0.0',
                    'x-prompt': promptMessage,
                    packages: {
                      child2: { version: '3.0.0' },
                      child3: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'child1' || p === 'child2' || p === 'child3') {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
          interactive: true,
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child1: { version: '3.0.0', addToPackageJson: false },
            child2: { version: '3.0.0', addToPackageJson: false },
            child3: { version: '3.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ message: promptMessage }),
          ])
        );
      });

      it('should filter out updates when prompt answer is false', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: false }));
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: { child1: '1.0.0', child2: '1.0.0', child3: '1.0.0' },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  version2: {
                    version: '2.0.0',
                    packages: {
                      child1: { version: '3.0.0' },
                    },
                  },
                  'version2-prompt-group': {
                    version: '2.0.0',
                    'x-prompt':
                      'Do you want to update the packages related to <some fwk name>?',
                    packages: {
                      child2: { version: '3.0.0' },
                      child3: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'child1' || p === 'child2' || p === 'child3') {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
          interactive: true,
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child1: { version: '3.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: '2.0.0',
        });
        expect(mockPrompt).toHaveBeenCalled();
      });

      it('should not prompt and get all updates when --interactive=false', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: false }));
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: { child1: '1.0.0', child2: '1.0.0', child3: '1.0.0' },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  version2: {
                    version: '2.0.0',
                    packages: {
                      child1: { version: '3.0.0' },
                    },
                  },
                  'version2-prompt-group': {
                    version: '2.0.0',
                    'x-prompt':
                      'Do you want to update the packages related to <some fwk name>?',
                    packages: {
                      child2: { version: '3.0.0' },
                      child3: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'child1' || p === 'child2' || p === 'child3') {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
          interactive: false,
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child1: { version: '3.0.0', addToPackageJson: false },
            child2: { version: '3.0.0', addToPackageJson: false },
            child3: { version: '3.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
        expect(mockPrompt).not.toHaveBeenCalled();
      });
    });

    describe('--include', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should keep required packages and drop optional ones when include is required', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              requiredChild: '1.0.0',
              optionalChild: '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  mixed: {
                    version: '2.0.0',
                    packages: {
                      requiredChild: { version: '3.0.0' },
                      optionalChild: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'requiredChild') {
              return Promise.resolve({ version: '3.0.0' });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          include: 'required',
          requiredPackages: new Set(['mypackage', 'requiredChild']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          mypackage: { version: '2.0.0', addToPackageJson: false },
          requiredChild: { version: '3.0.0', addToPackageJson: false },
        });
        expect(result.packageUpdates.optionalChild).toBeUndefined();
      });

      it('should drop entries that contain only optional packages without firing their x-prompt', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: true }));
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              optionalA: '1.0.0',
              optionalB: '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  optionalOnly: {
                    version: '2.0.0',
                    'x-prompt': 'Update optional packages?',
                    packages: {
                      optionalA: { version: '3.0.0' },
                      optionalB: { version: '3.0.0' },
                    },
                  },
                },
              });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          interactive: true,
          include: 'required',
          requiredPackages: new Set(['mypackage']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          mypackage: { version: '2.0.0', addToPackageJson: false },
        });
        expect(mockPrompt).not.toHaveBeenCalled();
      });

      it('should source required gate from the provided set, not getNxPackageGroup', async () => {
        // Sanity: a name commonly returned by getNxPackageGroup() that we
        // deliberately exclude from the required set should be filtered out,
        // and an arbitrary unrelated name that we include should be kept.
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              '@nx/react': '1.0.0',
              'not-in-nx-package-group': '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'nx') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  group: {
                    version: '2.0.0',
                    packages: {
                      '@nx/react': { version: '2.0.0' },
                      'not-in-nx-package-group': { version: '2.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'not-in-nx-package-group') {
              return Promise.resolve({ version: '2.0.0' });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          include: 'required',
          requiredPackages: new Set(['nx', 'not-in-nx-package-group']),
        });

        const result = await migrator.migrate('nx', '2.0.0');

        expect(result.packageUpdates).toEqual({
          nx: { version: '2.0.0', addToPackageJson: false },
          'not-in-nx-package-group': {
            version: '2.0.0',
            addToPackageJson: false,
          },
        });
        expect(result.packageUpdates['@nx/react']).toBeUndefined();
      });

      it('should drop required packages and keep optional ones when include is optional', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              requiredChild: '1.0.0',
              optionalChild: '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  mixed: {
                    version: '2.0.0',
                    packages: {
                      requiredChild: { version: '3.0.0' },
                      optionalChild: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'requiredChild' || p === 'optionalChild') {
              return Promise.resolve({ version: '3.0.0' });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          include: 'optional',
          requiredPackages: new Set(['mypackage', 'requiredChild']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          optionalChild: { version: '3.0.0', addToPackageJson: false },
        });
        expect(result.packageUpdates.mypackage).toBeUndefined();
        expect(result.packageUpdates.requiredChild).toBeUndefined();
      });

      it.each(['required', 'optional'] as const)(
        'should throw when constructed with include=%s but no requiredPackages',
        (include) => {
          // Other required callbacks are unused — constructor rejects before any
          // method runs — so stub them with the simplest valid shape.
          expect(
            () =>
              new Migrator({
                packageJson: createPackageJson({}),
                getInstalledPackageVersion: () => '0.0.0',
                fetch: () => Promise.resolve({ version: '0.0.0' }),
                from: {},
                to: {},
                include,
              })
          ).toThrow(
            `Error: 'requiredPackages' is required when 'include' is '${include}'.`
          );
        }
      );
    });

    describe('requirements', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should collect updates that meet requirements and leave out those that do not meet them', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              child1: '1.0.0',
              child2: '1.0.0',
              child3: '1.0.0',
              child4: '1.0.0',
              child5: '1.0.0',
              pkg1: '1.0.0',
              pkg2: '2.0.0',
            },
          }),
          getInstalledPackageVersion: (p) => (p === 'pkg2' ? '2.0.0' : '1.0.0'),
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  group1: {
                    version: '2.0.0',
                    packages: { child1: { version: '3.0.0' } },
                    requires: {
                      // exist on a lower version
                      pkg1: '^2.0.0',
                    },
                  },
                  group2: {
                    version: '2.0.0',
                    packages: {
                      child2: { version: '3.0.0' },
                      child3: { version: '3.0.0' },
                    },
                    requires: {
                      // exists on a version satisfying the range
                      pkg2: '^2.0.0',
                    },
                  },
                  group3: {
                    version: '2.0.0',
                    packages: {
                      child4: { version: '3.0.0' },
                      child5: { version: '3.0.0' },
                    },
                    requires: {
                      // non existent
                      pkg3: '^2.0.0',
                    },
                  },
                },
              });
            } else if (
              ['child1', 'child2', 'child3', 'child4', 'child5'].includes(p)
            ) {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child2: { version: '3.0.0', addToPackageJson: false },
            child3: { version: '3.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
      });

      it('should meet requirements with versions set by dependent package updates in package groups', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              child1: '1.0.0',
              child2: '1.0.0',
              child3: '1.0.0',
              pkg1: '1.0.0',
              pkg2: '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p): Promise<ResolvedMigrationConfiguration> => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  group1: {
                    version: '2.0.0',
                    packages: { child1: { version: '3.0.0' } },
                  },
                },
                packageGroup: [
                  { package: 'pkg1', version: '*' },
                  { package: 'pkg2', version: '*' },
                ],
              });
            } else if (p === 'pkg1') {
              // add a delay to showcase the dependent requirement will wait for it
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    version: '2.0.0',
                    packageJsonUpdates: {
                      group1: {
                        version: '2.0.0',
                        packages: { child2: { version: '3.0.0' } },
                        requires: { child1: '^3.0.0' },
                      },
                    },
                  });
                }, 100);
              });
            } else if (p === 'pkg2') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  group1: {
                    version: '2.0.0',
                    packages: { child3: { version: '3.0.0' } },
                    // installed version doesn't satisfy the requirements, but
                    // a package update from "pkg1" fulfills it, it waits for it
                    // because of the packageGroup order
                    requires: { child2: '^3.0.0' },
                  },
                },
              });
            } else if (['child1', 'child2', 'child3'].includes(p)) {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child1: { version: '3.0.0', addToPackageJson: false },
            child2: { version: '3.0.0', addToPackageJson: false },
            child3: { version: '3.0.0', addToPackageJson: false },
            pkg1: { version: '2.0.0', addToPackageJson: false },
            pkg2: { version: '2.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
      });

      it('should prompt when requirements are met', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: true }));
        const promptMessage =
          'Do you want to update the packages related to <some fwk name>?';
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: { child1: '1.0.0', pkg1: '2.0.0' },
          }),
          getInstalledPackageVersion: (p) => (p === 'pkg1' ? '2.0.0' : '1.0.0'),
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  version2: {
                    version: '2.0.0',
                    'x-prompt': promptMessage,
                    requires: { pkg1: '^2.0.0' },
                    packages: {
                      child1: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'child1') {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
          interactive: true,
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
            child1: { version: '3.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ message: promptMessage }),
          ])
        );
      });

      it('should not prompt when requirements are not met', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: true }));
        const promptMessage =
          'Do you want to update the packages related to <some fwk name>?';
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: { child1: '1.0.0', pkg1: '1.0.0' },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  version2: {
                    version: '2.0.0',
                    'x-prompt': promptMessage,
                    requires: { pkg1: '^2.0.0' },
                    packages: {
                      child1: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'child1') {
              return Promise.resolve({ version: '3.0.0' });
            } else {
              return Promise.resolve(null);
            }
          },
          from: {},
          to: {},
          interactive: true,
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result).toStrictEqual({
          migrations: [],
          packageUpdates: {
            mypackage: { version: '2.0.0', addToPackageJson: false },
          },
          minVersionWithSkippedUpdates: undefined,
        });
        expect(mockPrompt).not.toHaveBeenCalled();
      });
    });
  });

  describe('migrations', () => {
    it('should create a list of migrations to run', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { child: '1.0.0', newChild: '1.0.0' },
        }),
        getInstalledPackageVersion: (p) => {
          if (p === 'parent') return '1.0.0';
          if (p === 'child') return '1.0.0';
          return null;
        },
        fetch: (p: string): Promise<ResolvedMigrationConfiguration> => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                    newChild: {
                      version: '3.0.0',
                    },
                  },
                },
              },
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'parent-desc',
                },
              },
            });
          } else if (p === 'child') {
            return Promise.resolve({
              version: '2.0.0',
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'child-desc',
                },
              },
            });
          } else if (p === 'newChild') {
            return Promise.resolve({
              version: '3.0.0',
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'new-child-desc',
                },
              },
            });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });
      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [
          {
            version: '2.0.0',
            name: 'version2',
            package: 'parent',
            description: 'parent-desc',
          },
          {
            package: 'child',
            version: '2.0.0',
            name: 'version2',
            description: 'child-desc',
          },
        ],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
          newChild: { version: '3.0.0', addToPackageJson: false },
        },
      });
    });

    it('should not generate migrations for non top-level packages', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        getInstalledPackageVersion: (p) => {
          if (p === 'parent') return '1.0.0';
          if (p === 'child') return '1.0.0';
          if (p === 'newChild') return '1.0.0'; // installed as a transitive dep, not a top-level dep
          return null;
        },
        fetch: (p: string): Promise<ResolvedMigrationConfiguration> => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                    newChild: {
                      version: '3.0.0',
                    },
                  },
                },
              },
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'parent-desc',
                },
              },
            });
          } else if (p === 'child') {
            return Promise.resolve({
              version: '2.0.0',
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'child-desc',
                },
              },
            });
          } else if (p === 'newChild') {
            return Promise.resolve({
              version: '3.0.0',
              generators: {
                version2: {
                  version: '3.0.0',
                  description: 'new-child-desc',
                },
              },
            });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      expect(await migrator.migrate('parent', '2.0.0')).toEqual({
        migrations: [
          {
            version: '2.0.0',
            name: 'version2',
            package: 'parent',
            description: 'parent-desc',
          },
          {
            package: 'child',
            version: '2.0.0',
            name: 'version2',
            description: 'child-desc',
          },
        ],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should not generate migrations for packages which confirmation prompt answer was false', async () => {
      mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: false }));
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { child: '1.0.0', child2: '1.0.0' },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: (p) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '2.0.0' },
                    child2: { version: '3.0.0' },
                  },
                  'x-prompt':
                    'Do you want to update the packages related to <some fwk name>?',
                },
              },
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'parent-desc',
                },
              },
            });
          } else if (p === 'child1') {
            return Promise.resolve({
              version: '2.0.0',
              generators: {
                version2: {
                  version: '2.0.0',
                  description: 'child1-desc',
                },
              },
            });
          } else if (p === 'child2') {
            return Promise.resolve({
              version: '3.0.0',
              generators: {
                version2: {
                  version: '3.0.0',
                  description: 'child2-desc',
                },
              },
            });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
        interactive: true,
      });

      const result = await migrator.migrate('parent', '2.0.0');

      expect(result).toEqual({
        migrations: [
          {
            version: '2.0.0',
            name: 'version2',
            package: 'parent',
            description: 'parent-desc',
          },
        ],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
        },
        minVersionWithSkippedUpdates: '2.0.0',
      });
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should generate migrations that meet requirements and leave out those that do not meet them', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            child1: '1.0.0',
            child2: '1.0.0',
            pkg1: '1.0.0',
            pkg2: '2.0.0',
            pkg3: '2.0.0',
          },
        }),
        getInstalledPackageVersion: (p) =>
          p === 'pkg2' || p === 'pkg3' ? '2.0.0' : '1.0.0',
        fetch: (p) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child1: { version: '2.0.0' },
                    child2: { version: '3.0.0' },
                  },
                },
              },
              generators: {
                migration1: {
                  version: '2.0.0',
                  description: 'migration1 desc',
                  requires: {
                    // exist on a lower version
                    pkg1: '^2.0.0',
                  },
                },
                migration2: {
                  version: '2.0.0',
                  description: 'migration2 desc',
                  requires: {
                    // exists on a version satisfying the range
                    pkg2: '^2.0.0',
                  },
                },
              },
            });
          } else if (p === 'child1') {
            return Promise.resolve({
              version: '2.0.0',
              generators: {
                migration1: {
                  version: '2.0.0',
                  description: 'child1 - migration 1 desc',
                  requires: {
                    // exists on a version satisfying the range
                    pkg3: '^2.0.0',
                  },
                },
              },
            });
          } else if (p === 'child2') {
            return Promise.resolve({
              version: '3.0.0',
              generators: {
                migration1: {
                  version: '3.0.0',
                  description: 'child2 - migration1 desc',
                  requires: {
                    // non existent
                    pkg4: '^2.0.0',
                  },
                },
              },
            });
          } else {
            return Promise.resolve(null);
          }
        },
        from: {},
        to: {},
      });

      const result = await migrator.migrate('parent', '2.0.0');

      expect(result).toEqual({
        migrations: [
          {
            version: '2.0.0',
            name: 'migration2',
            package: 'parent',
            description: 'migration2 desc',
            requires: { pkg2: '^2.0.0' },
          },
          {
            version: '2.0.0',
            name: 'migration1',
            package: 'child1',
            description: 'child1 - migration 1 desc',
            requires: { pkg3: '^2.0.0' },
          },
        ],
        packageUpdates: {
          child1: { version: '2.0.0', addToPackageJson: false },
          child2: { version: '3.0.0', addToPackageJson: false },
          parent: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should generate the correct migrations when  "--exclude-applied-migrations"', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            parent: '1.0.0',
            pkg1: '1.0.0',
          },
        }),
        getInstalledPackageVersion: (p, overrides) => overrides?.[p] ?? '1.0.0',
        fetch: (p) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageGroup: [{ package: 'pkg1', version: '*' }],
              generators: {
                // previous migration
                migration1: {
                  version: '1.0.0',
                  description: 'migration1 desc',
                  requires: {
                    // didn't meet requirements and now meets requirements, should collect it
                    pkg1: '>=2.0.0',
                  },
                },
                // previous migration
                migration2: {
                  version: '1.0.0',
                  description: 'migration2 desc',
                  requires: {
                    // didn't meet requirements and now doesn't meet requirements, should not collect it
                    pkg1: '>=3.0.0',
                  },
                },
                // previous migration, no requirements, should not collect it
                migration3: {
                  version: '1.0.0',
                  description: 'migration3 desc',
                },
                // new migration
                migration4: {
                  version: '2.0.0',
                  description: 'migration4 desc',
                  requires: {
                    // meets requirements, should collect it
                    pkg1: '>=2.0.0',
                  },
                },
                // new migration
                migration5: {
                  version: '2.0.0',
                  description: 'migration5 desc',
                  requires: {
                    // doesn't meet requirements, should not collect it
                    pkg1: '>=3.0.0',
                  },
                },
                // new migrationg, no requirements, should collect it
                migration6: {
                  version: '2.0.0',
                  description: 'migration6 desc',
                },
              },
            });
          } else if (p === 'pkg1') {
            return Promise.resolve({ version: '2.0.0' });
          } else {
            return Promise.resolve(null);
          }
        },
        from: { parent: '0.1.0' },
        to: {},
        excludeAppliedMigrations: true,
      });

      const result = await migrator.migrate('parent', '2.0.0');

      expect(result).toEqual({
        migrations: [
          {
            version: '1.0.0',
            name: 'migration1',
            package: 'parent',
            description: 'migration1 desc',
            requires: { pkg1: '>=2.0.0' },
          },
          {
            version: '2.0.0',
            name: 'migration4',
            package: 'parent',
            description: 'migration4 desc',
            requires: { pkg1: '>=2.0.0' },
          },
          {
            version: '2.0.0',
            name: 'migration6',
            package: 'parent',
            description: 'migration6 desc',
          },
        ],
        packageUpdates: {
          parent: { version: '2.0.0', addToPackageJson: false },
          pkg1: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });
  });

  describe('normalizeVersions', () => {
    it('should return version when it meets semver requirements', () => {
      expect(normalizeVersion('1.2.3')).toEqual('1.2.3');
      expect(normalizeVersion('1.2.3-beta.1')).toEqual('1.2.3-beta.1');
      expect(normalizeVersion('1.2.3-beta-next.1')).toEqual(
        '1.2.3-beta-next.1'
      );
    });

    it('should handle versions missing a patch or a minor', () => {
      expect(normalizeVersion('1.2')).toEqual('1.2.0');
      expect(normalizeVersion('1')).toEqual('1.0.0');
      expect(normalizeVersion('1-beta.1')).toEqual('1.0.0-beta.1');
    });

    it('should handle incorrect versions', () => {
      expect(normalizeVersion('1-invalid-version')).toEqual(
        '1.0.0-invalid-version'
      );
      expect(normalizeVersion('1.invalid-version')).toEqual('1.0.0');
      expect(normalizeVersion('invalid-version')).toEqual('0.0.0');
    });
  });

  describe('command failures', () => {
    it('should format child process failures using stderr output', () => {
      expect(
        formatCommandFailure('pnpm add nx@22.6.1', {
          message: 'Command failed: pnpm add nx@22.6.1',
          stderr: 'ERR_PNPM_FETCH_404 GET https://registry.npmjs.org/nx',
        })
      ).toBe(
        [
          'Command failed: pnpm add nx@22.6.1',
          'ERR_PNPM_FETCH_404 GET https://registry.npmjs.org/nx',
        ].join('\n')
      );
    });

    it('should fall back to the child process message when no output is available', () => {
      expect(
        formatCommandFailure('pnpm add nx@22.6.1', {
          message:
            'Command failed: pnpm add nx@22.6.1\nSomething else went wrong',
        })
      ).toBe(
        [
          'Command failed: pnpm add nx@22.6.1',
          'Something else went wrong',
        ].join('\n')
      );
    });
  });

  describe('parseMigrationsOptions', () => {
    // Pin non-TTY so the canPrompt-gated eligibility fetch stays off as it does
    // on CI, instead of hitting the registry in a local TTY run.
    let originalStdinIsTTY: boolean | undefined;
    beforeEach(() => {
      originalStdinIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      // `getInstalledVersion(pkg)` mirrors the installed nx version for the
      // canonical packages so optional bound checks read the same value.
      mockGetInstalledVersion.mockImplementation((pkg: string) =>
        pkg === 'nx' || pkg === '@nx/workspace'
          ? mockGetInstalledNxVersion()
          : null
      );
      mockGetInstalledPackageGroup.mockReturnValue(
        new Set([
          'nx',
          'nx-cloud',
          'create-nx-workspace',
          '@nx/js',
          '@nx/workspace',
          '@nx/react',
        ])
      );
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(null);
    });
    afterEach(() => {
      mockGetInstalledNxVersion.mockReset();
      mockGetInstalledVersion.mockReset();
      mockGetInstalledPackageGroup.mockReset();
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReset();
      jest.restoreAllMocks();
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalStdinIsTTY,
        configurable: true,
      });
    });

    it('should work for generating migrations', async () => {
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockResolvedValue('12.3.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: '8.12.0',
        from: '@myscope/a@12.3,@myscope/b@1.1.1',
        to: '@myscope/c@12.3.1',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
        from: {
          '@myscope/a': '12.3.0',
          '@myscope/b': '1.1.1',
        },
        to: {
          '@myscope/c': '12.3.1',
        },
      });
    });

    it('should work for running migrations', async () => {
      const r = await parseMigrationsOptions({
        runMigrations: '',
        ifExists: true,
      });
      expect(r).toEqual({
        type: 'runMigrations',
        runMigrations: 'migrations.json',
        ifExists: true,
        agentic: undefined,
        validate: undefined,
      });
    });

    it('should propagate the agentic and validate values when running migrations', async () => {
      const r = await parseMigrationsOptions({
        runMigrations: '',
        ifExists: true,
        agentic: 'claude-code',
        validate: false,
      });
      expect(r).toMatchObject({
        type: 'runMigrations',
        agentic: 'claude-code',
        validate: false,
      });
    });

    it('should propagate the interactive value when running migrations', async () => {
      const r = await parseMigrationsOptions({
        runMigrations: '',
        ifExists: true,
        interactive: false,
      });
      expect(r).toMatchObject({
        type: 'runMigrations',
        interactive: false,
      });
    });

    it('should default to nx@latest when no packageAndVersion is provided', async () => {
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockImplementation((pkg, version) => Promise.resolve(version));
      const r = await parseMigrationsOptions({});
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: 'latest',
      });
    });

    it.each([
      {
        desc: 'pre-v22 modern install',
        installedNx: '21.3.0',
        installedLegacy: null,
      },
      {
        desc: 'legacy nx (<14) install',
        installedNx: '13.5.0',
        installedLegacy: null,
      },
      {
        desc: 'legacy @nrwl/workspace install',
        installedNx: null,
        installedLegacy: '13.5.0',
      },
      { desc: 'nx not installed', installedNx: null, installedLegacy: null },
    ])(
      'should throw for a bare invocation on a pre-v22 install: $desc',
      async ({ installedNx, installedLegacy }) => {
        mockGetInstalledNxVersion.mockReturnValue(installedNx);
        mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(
          installedLegacy
        );
        await expect(() => parseMigrationsOptions({})).rejects.toThrow(
          'Provide the package and version to migrate to. E.g., `nx migrate nx@<version>`.'
        );
      }
    );

    it('should resolve the latest dist-tag up front for a bare invocation on v22+', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockResolvedValue('23.1.0');
      const r = await parseMigrationsOptions({});
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '23.1.0',
      });
    });

    it('should accept --include=required for a target that supports optional updates', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: 'nx@23.0.0',
          include: 'required',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '23.0.0',
        include: 'required',
      });
    });

    it('should accept --include=required for a non-nx target that supports optional updates', async () => {
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: '@nx/react@23.0.0',
          include: 'required',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nx/react',
        targetVersion: '23.0.0',
        include: 'required',
      });
    });

    it('should reject --include for a target that does not support optional updates', async () => {
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: '@nx/react@22.0.0',
            include: 'required',
          },
          includeGateFetch(false)
        )
      ).rejects.toThrow(
        `Error: '--include' requires the target package to support optional updates, but '@nx/react@22.0.0' does not.`
      );
    });

    it('should accept --include combined with --interactive for a target that supports optional updates', async () => {
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: 'nx@23.0.0',
          include: 'required',
          interactive: true,
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '23.0.0',
        include: 'required',
        interactive: true,
      });
    });

    it('should reject --include=optional combined with --interactive', async () => {
      await expect(() =>
        parseMigrationsOptions({ include: 'optional', interactive: true })
      ).rejects.toThrow(
        `Error: '--include=optional' cannot be combined with '--interactive'.`
      );
    });

    it('should reject the nx.json `optional` value combined with --interactive', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@22.5.0',
            includeFromConfig: 'optional',
            interactive: true,
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot be combined with '--interactive'.`
      );
    });

    it('should allow --interactive for a target that supports optional updates (resolves to "all" in non-TTY)', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@22.7.0',
        interactive: true,
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '22.7.0',
        interactive: true,
        include: 'all',
      });
    });

    it('should allow --no-interactive when migrating to v23+', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@23.0.0',
        interactive: false,
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '23.0.0',
        interactive: false,
      });
    });

    it('should allow --interactive for non-nx-equivalent targets', async () => {
      const r = await parseMigrationsOptions({
        packageAndVersion: 'mypackage@2.0.0',
        interactive: true,
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'mypackage',
        targetVersion: '2.0.0',
        interactive: true,
        include: 'all',
      });
    });

    it('should handle different variations of the target package', async () => {
      const packageRegistryViewSpy = jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockImplementation((pkg, version) => {
          return Promise.resolve(version);
        });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '@angular/core' })
      ).toMatchObject({
        targetPackage: '@angular/core',
        targetVersion: 'latest',
      });
      packageRegistryViewSpy.mockResolvedValue('8.12.5');
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8.12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.5',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.5',
      });
      packageRegistryViewSpy.mockResolvedValue('12.6.3');
      expect(
        await parseMigrationsOptions({ packageAndVersion: '12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '12.6.3',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8.12.0-beta.0' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0-beta.0',
      });
      packageRegistryViewSpy.mockImplementation((pkg, version) =>
        Promise.resolve(version)
      );
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'next' })
      ).toMatchObject({
        targetPackage: 'nx',
        targetVersion: 'next',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'canary' })
      ).toMatchObject({
        targetPackage: 'nx',
        targetVersion: 'canary',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '13.10.0' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '13.10.0',
      });
      packageRegistryViewSpy.mockResolvedValue('8.12.0');
      expect(
        await parseMigrationsOptions({
          packageAndVersion: '@nx/workspace@8.12',
        })
      ).toMatchObject({
        targetPackage: '@nx/workspace',
        targetVersion: '8.12.0',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'mypackage@8.12' })
      ).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: '8.12.0',
      });
      packageRegistryViewSpy.mockImplementation((pkg, version) =>
        Promise.resolve(version)
      );
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'mypackage' })
      ).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: 'latest',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'mypackage2' })
      ).toMatchObject({
        targetPackage: 'mypackage2',
        targetVersion: 'latest',
      });
      expect(
        await parseMigrationsOptions({
          packageAndVersion: '@nx/workspace@latest',
        })
      ).toMatchObject({
        targetPackage: '@nx/workspace',
        targetVersion: 'latest',
      });
      expect(
        await parseMigrationsOptions({
          packageAndVersion: '@nx/workspace@alpha',
        })
      ).toMatchObject({
        targetPackage: '@nx/workspace',
        targetVersion: 'alpha',
      });
    });

    it('should handle incorrect from', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          from: '@myscope/a@',
        })
      ).rejects.toThrow(
        `Incorrect 'from' section. Use --from="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          from: '@myscope/a',
        })
      ).rejects.toThrow(
        `Incorrect 'from' section. Use --from="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', from: 'myscope' })
      ).rejects.toThrow(
        `Incorrect 'from' section. Use --from="package@version"`
      );
    });

    it('should handle incorrect to', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a@',
        })
      ).rejects.toThrow(`Incorrect 'to' section. Use --to="package@version"`);
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a',
        })
      ).rejects.toThrow(`Incorrect 'to' section. Use --to="package@version"`);
      await expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', to: 'myscope' })
      ).rejects.toThrow(`Incorrect 'to' section. Use --to="package@version"`);
    });

    it('should reject --include combined with --run-migrations', async () => {
      await expect(() =>
        parseMigrationsOptions({
          runMigrations: 'migrations.json',
          include: 'required',
        })
      ).rejects.toThrow(
        `Error: '--include' cannot be combined with '--run-migrations'.`
      );
    });

    it('should reject --include for a modern target that does not support optional updates', async () => {
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: '@nx/react@22.0.0',
            include: 'required',
          },
          includeGateFetch(false)
        )
      ).rejects.toThrow(
        `Error: '--include' requires the target package to support optional updates, but '@nx/react@22.0.0' does not.`
      );
    });

    it('should reject --include for a legacy target that does not support optional updates', async () => {
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@13.0.0',
            include: 'required',
          },
          includeGateFetch(false)
        )
      ).rejects.toThrow(
        `Error: '--include' requires the target package to support optional updates, but 'nx@13.0.0' does not.`
      );
    });

    it('should reject --include=optional combined with --from', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          include: 'optional',
          from: 'nx@21.0.0',
        })
      ).rejects.toThrow(
        `Error: '--include=optional' cannot be combined with '--from'.`
      );
    });

    it('should reject --include=optional combined with --exclude-applied-migrations', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          include: 'optional',
          excludeAppliedMigrations: true,
        })
      ).rejects.toThrow(
        `Error: '--include=optional' cannot be combined with '--exclude-applied-migrations'.`
      );
    });

    it.each([
      {
        desc: 'bare invocation, modern nx installed',
        positional: undefined,
        installedNx: '23.5.0',
        installedLegacy: null,
        expected: { targetPackage: 'nx', targetVersion: '23.5.0' },
      },
      {
        desc: 'bare-package-name positional `nx`, modern nx installed',
        positional: 'nx',
        installedNx: '23.5.0',
        installedLegacy: null,
        expected: { targetPackage: 'nx', targetVersion: '23.5.0' },
      },
    ])(
      'should anchor --include=optional to installed canonical: $desc',
      async ({ positional, installedNx, installedLegacy, expected }) => {
        mockGetInstalledNxVersion.mockReturnValue(installedNx);
        mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(
          installedLegacy
        );
        const r = await parseMigrationsOptions(
          {
            ...(positional ? { packageAndVersion: positional } : {}),
            include: 'optional',
          },
          includeGateFetch()
        );
        expect(r).toMatchObject({
          type: 'generateMigrations',
          include: 'optional',
          ...expected,
        });
      }
    );

    it('should reject --include=optional when nx is not installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue(null);
      await expect(() =>
        parseMigrationsOptions({ include: 'optional' })
      ).rejects.toThrow(
        `Error: '--include=optional' requires 'nx' (or '@nrwl/workspace' on Nx <14) to be installed in your workspace.`
      );
    });

    it('should reject --include=optional when target is higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@24.0.0',
            include: 'optional',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got 'nx@24.0.0', installed 'nx@23.0.0').`
      );
    });

    it('should accept --include=optional when target is lower than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.5.0');
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: 'nx@23.0.0',
          include: 'optional',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '23.0.0',
        include: 'optional',
      });
    });

    it('should gate --include=optional on the installed version, not the older explicit target', async () => {
      // Catch-up reads `supportsOptionalMigrations` at the INSTALLED version (what you
      // have), not the older explicit target. The stub only marks 23.0.0 as
      // supporting optional updates, so eligibility proves the gate read installed 23,
      // even though the target 22 predates the flag.
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: 'nx@22.0.0',
          include: 'optional',
        },
        includeGateFetch((_pkg, version) => version === '23.0.0')
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '22.0.0',
        include: 'optional',
      });
    });

    it('should reject --include=optional when the installed version does not support optional updates, naming the installed version', async () => {
      // Reject mirror of the gate above: eligibility reads the INSTALLED
      // version, so the rejection names installed 22 - not the older explicit
      // target 21. The stub marks only 23.0.0 as supporting optional updates.
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@21.0.0',
            include: 'optional',
          },
          includeGateFetch((_pkg, version) => version === '23.0.0')
        )
      ).rejects.toThrow(
        `Error: '--include' requires the target package to support optional updates, but 'nx@22.0.0' does not.`
      );
    });

    it('should surface a fetch failure instead of reporting the target as unsupported', async () => {
      // The gate resolves `supportsOptionalMigrations` through the shared fetcher (registry,
      // then install). A genuine fetch failure must surface as-is, not be
      // swallowed into a misleading "does not support optional updates" rejection.
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      const failingFetch = () =>
        Promise.reject(new Error('registry and install both failed'));
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@23.0.0',
            include: 'required',
          },
          failingFetch as any
        )
      ).rejects.toThrow('registry and install both failed');
    });

    it('should accept --include=optional with @nx/workspace target, preserve typed target, and swap to nx canonical at walk time', async () => {
      // `parseMigrationsOptions` preserves the typed target verbatim; the
      // silent `@nx/workspace` → `nx` swap happens later in
      // `generateMigrationsJsonAndUpdatePackageJson` via
      // `resolveCanonicalNxPackage`.
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: '@nx/workspace@23.0.0',
          include: 'optional',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nx/workspace',
        targetVersion: '23.0.0',
        include: 'optional',
      });
      expect(
        resolveCanonicalNxPackage(
          (r as { targetVersion: string }).targetVersion
        )
      ).toBe('nx');
    });

    it('should anchor @nx/workspace --include=optional to installed nx when only nx is installed', async () => {
      // #2 regression: the installed lookup must normalize `@nx/workspace` ->
      // `nx`. With @nx/workspace absent but nx present, it resolves against nx
      // instead of failing "requires @nx/workspace to be installed".
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      mockGetInstalledVersion.mockImplementation((pkg: string) =>
        pkg === 'nx' ? '23.0.0' : null
      );
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: '@nx/workspace',
          include: 'optional',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nx/workspace',
        targetVersion: '23.0.0',
        include: 'optional',
      });
    });

    it('should reject --include=optional with --to canonical higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@23.0.0',
            include: 'optional',
            to: 'nx@24.0.0',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got '--to nx@24.0.0', installed 'nx@23.0.0').`
      );
    });

    it('should reject --include=optional with --to for required packages higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@23.0.0',
            include: 'optional',
            to: '@nx/js@23.6.4',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got '--to @nx/js@23.6.4', installed 'nx@23.0.0').`
      );
    });

    it('should reject --include=optional with --to create-nx-workspace higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@23.0.0',
            include: 'optional',
            to: 'create-nx-workspace@23.6.4',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got '--to create-nx-workspace@23.6.4', installed 'nx@23.0.0').`
      );
    });

    it('should reject --include=optional with --to @nx/workspace higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: 'nx@23.0.0',
            include: 'optional',
            to: '@nx/workspace@24.0.0',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got '--to @nx/workspace@24.0.0', installed 'nx@23.0.0').`
      );
    });

    it('should cap --to against nx full group when migrating @nx/workspace in `optional` value', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      // `@nx/workspace` declares a narrow group; the bound check must use nx's
      // full closure (which includes `@nx/jest`) to mirror the walk.
      mockGetInstalledPackageGroup.mockImplementation((pkg: string) =>
        pkg === '@nx/workspace'
          ? new Set(['@nx/workspace', 'nx', 'nx-cloud'])
          : new Set(['nx', 'nx-cloud', '@nx/js', '@nx/jest', '@nx/react'])
      );
      await expect(() =>
        parseMigrationsOptions(
          {
            packageAndVersion: '@nx/workspace',
            include: 'optional',
            to: '@nx/jest@24.0.0',
          },
          includeGateFetch()
        )
      ).rejects.toThrow(
        `Error: '--include=optional' cannot migrate to a version higher than what is currently installed (got '--to @nx/jest@24.0.0', installed 'nx@22.0.0').`
      );
    });

    it('should accept --include=optional with --to for non-canonical packages', async () => {
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      const r = await parseMigrationsOptions(
        {
          packageAndVersion: 'nx@23.0.0',
          include: 'optional',
          to: 'react@18.0.0',
        },
        includeGateFetch()
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        include: 'optional',
        to: { react: '18.0.0' },
      });
    });

    it('should handle backslashes in package names', async () => {
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockImplementation((pkg, version) => {
          return Promise.resolve('12.3.0');
        });
      const r = await parseMigrationsOptions({
        packageAndVersion: '@nx\\workspace@8.12.0',
        from: '@myscope\\a@12.3,@myscope\\b@1.1.1',
        to: '@myscope\\c@12.3.1',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nx/workspace',
        targetVersion: '8.12.0',
        from: {
          '@myscope/a': '12.3.0',
          '@myscope/b': '1.1.1',
        },
        to: {
          '@myscope/c': '12.3.1',
        },
      });
    });

    it('should skip packageJsonUpdates when incompatible packages are present', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            parent: '1.0.0',
            'incompatible-package': '1.0.0',
          },
        }),
        getInstalledPackageVersion: (pkg) => {
          if (pkg === 'parent') return '1.0.0';
          if (pkg === 'incompatible-package') return '1.0.0';
          return null;
        },
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                  },
                  incompatibleWith: {
                    'incompatible-package': '*',
                  },
                },
              },
              schematics: {},
            });
          }
          return Promise.resolve(null);
        },
        from: {},
        to: {},
      });

      const result = await migrator.migrate('parent', '2.0.0');

      // The packageJsonUpdate should be skipped due to incompatibleWith
      expect(result.packageUpdates).toEqual({
        parent: { version: '2.0.0', addToPackageJson: false },
      });
      // 'child' should not be in packageUpdates because the update was skipped
      expect(result.packageUpdates.child).toBeUndefined();
    });

    it('should apply packageJsonUpdates when incompatible packages are not present', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: {
            parent: '1.0.0',
            child: '1.0.0',
          },
        }),
        getInstalledPackageVersion: (pkg) => {
          if (pkg === 'parent') return '1.0.0';
          if (pkg === 'child') return '1.0.0';
          return null; // incompatible-package is not installed
        },
        fetch: (p, _v) => {
          if (p === 'parent') {
            return Promise.resolve({
              version: '2.0.0',
              packageJsonUpdates: {
                version2: {
                  version: '2.0.0',
                  packages: {
                    child: { version: '2.0.0' },
                  },
                  incompatibleWith: {
                    'incompatible-package': '*',
                  },
                },
              },
              schematics: {},
            });
          }
          if (p === 'child') {
            return Promise.resolve({
              version: '2.0.0',
              schematics: {},
            });
          }
          return Promise.resolve(null);
        },
        from: {},
        to: {},
      });

      const result = await migrator.migrate('parent', '2.0.0');

      // The packageJsonUpdate should be applied since incompatible package is not present
      expect(result.packageUpdates).toEqual({
        parent: { version: '2.0.0', addToPackageJson: false },
        child: { version: '2.0.0', addToPackageJson: false },
      });
    });

    describe('nx.json migrate.include overlay (integration)', () => {
      it('does not treat nx.json migrate.include as an explicit --include for a target that does not support optional updates', async () => {
        // The original footgun: a workspace-wide migrate.include default made
        // `nx migrate <pkg>` hard-fail with a `--include` error the user never
        // passed. The overlay must carry it as a default, not a flag, and a
        // target that doesn't support optional updates must fall back to 'all' with a warning.
        const warnSpy = jest
          .spyOn(require('../../utils/output').output, 'warn')
          .mockImplementation(() => {});
        const result = await parseMigrationsOptions(
          applyNxJsonMigrateDefaults(
            { packageAndVersion: '@angular/core@18.0.0' },
            { include: 'required' }
          ),
          includeGateFetch(false)
        );
        expect(result).toMatchObject({
          type: 'generateMigrations',
          targetPackage: '@angular/core',
          include: 'all',
        });
        expect(warnSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining(
              "The configured nx.json migrate.include 'required' is not available"
            ),
          })
        );
      });

      it('applies nx.json migrate.include through the overlay for a target that supports optional updates', async () => {
        const result = await parseMigrationsOptions(
          applyNxJsonMigrateDefaults(
            { packageAndVersion: 'nx@23.0.0' },
            { include: 'required' }
          ),
          includeGateFetch()
        );
        expect(result).toMatchObject({
          type: 'generateMigrations',
          targetPackage: 'nx',
          include: 'required',
        });
      });
    });
  });

  describe('resolveInclude', () => {
    let originalCi: string | undefined;
    let originalTty: boolean | undefined;

    beforeEach(() => {
      originalCi = process.env.CI;
      originalTty = process.stdin.isTTY;
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalTty,
        configurable: true,
      });
    });

    const supportsOptionalMigrationsContext = {
      hasFrom: false,
      hasExcludeAppliedMigrations: false,
      targetSupportsOptionalUpdates: true,
    };

    it('should return the provided include without prompting', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(
        'required',
        supportsOptionalMigrationsContext
      );
      expect(result).toBe('required');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should return the provided include even when the target does not support optional updates', async () => {
      // The `supportsOptionalMigrations` gate is enforced in `resolveTargetAndInclude`;
      // `resolveInclude` honors an explicit include as-is.
      const result = await resolveInclude('required', {
        hasFrom: false,
        hasExcludeAppliedMigrations: false,
        targetSupportsOptionalUpdates: false,
      });
      expect(result).toBe('required');
    });

    it('should default to "all" without prompting in non-TTY environments', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(
        undefined,
        supportsOptionalMigrationsContext
      );
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting when running in CI', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'true';
      const result = await resolveInclude(
        undefined,
        supportsOptionalMigrationsContext
      );
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting when --no-interactive is passed in a TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(undefined, {
        ...supportsOptionalMigrationsContext,
        interactive: false,
      });
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting when the target does not support optional updates', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(undefined, {
        hasFrom: false,
        hasExcludeAppliedMigrations: false,
        targetSupportsOptionalUpdates: false,
      });
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should prompt and return the selection in interactive TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ include: 'required' }));
      const result = await resolveInclude(
        undefined,
        supportsOptionalMigrationsContext
      );
      expect(result).toBe('required');
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should include optional in prompt choices by default', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ include: 'all' }));
      await resolveInclude(undefined, supportsOptionalMigrationsContext);
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'required',
        'optional',
        'all',
      ]);
    });

    it('should hide optional from prompt choices when --from is provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ include: 'all' }));
      await resolveInclude(undefined, {
        hasFrom: true,
        hasExcludeAppliedMigrations: false,
        targetSupportsOptionalUpdates: true,
      });
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'required',
        'all',
      ]);
    });

    it('should hide optional from prompt choices when --exclude-applied-migrations is provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ include: 'all' }));
      await resolveInclude(undefined, {
        hasFrom: false,
        hasExcludeAppliedMigrations: true,
        targetSupportsOptionalUpdates: true,
      });
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'required',
        'all',
      ]);
    });

    it('should hide optional from prompt choices when --interactive is provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ include: 'all' }));
      await resolveInclude(undefined, {
        ...supportsOptionalMigrationsContext,
        interactive: true,
      });
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'required',
        'all',
      ]);
    });

    it('uses the nx.json configured include for a target that supports optional updates without prompting', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(
        undefined,
        supportsOptionalMigrationsContext,
        'required'
      );
      expect(result).toBe('required');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('uses the nx.json configured include for a target that supports optional updates in CI', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'true';
      const result = await resolveInclude(
        undefined,
        supportsOptionalMigrationsContext,
        'required'
      );
      expect(result).toBe('required');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('lets an explicit include win over the nx.json configured include', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(
        'all',
        supportsOptionalMigrationsContext,
        'required'
      );
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('ignores the nx.json configured include when the target does not support optional updates', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveInclude(
        undefined,
        {
          hasFrom: false,
          hasExcludeAppliedMigrations: false,
          targetSupportsOptionalUpdates: false,
        },
        'required'
      );
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });
  });

  describe('resolveCanonicalNxPackage', () => {
    it.each([
      ['14.0.0', 'nx'],
      ['14.0.0-beta.0', 'nx'],
      ['13.0.0', '@nrwl/workspace'],
    ] as const)('should resolve %s to %s', (version, expected) => {
      expect(resolveCanonicalNxPackage(version)).toBe(expected);
    });
  });

  describe('filterDowngradedUpdates', () => {
    it('should drop updates whose proposed version is lower than resolved', () => {
      const result = filterDowngradedUpdates(
        {
          react: { version: '18.3.1', addToPackageJson: 'dependencies' },
        },
        createPackageJson({ dependencies: { react: '19.0.0' } }),
        () => '19.0.0'
      );

      expect(result).toEqual({});
    });

    it('should keep updates whose proposed version is strictly newer than resolved', () => {
      const update = {
        version: '20.0.0',
        addToPackageJson: 'dependencies' as const,
      };
      const result = filterDowngradedUpdates(
        { react: update },
        createPackageJson({ dependencies: { react: '19.0.0' } }),
        () => '19.0.0'
      );

      expect(result).toEqual({ react: update });
    });

    it('should keep updates when the package is not installed', () => {
      const update = {
        version: '1.0.0',
        addToPackageJson: 'dependencies' as const,
      };
      const result = filterDowngradedUpdates(
        { 'new-pkg': update },
        createPackageJson({}),
        () => null
      );

      expect(result).toEqual({ 'new-pkg': update });
    });

    it('should keep narrowing rewrites where the specifier covers a lower version than resolved', () => {
      // user has `vite: ^6.0.0`, resolved 6.4.2. Cascade proposes `6.4.2` (exact).
      // Specifier floor is 6.0.0 < resolved 6.4.2 → narrowing → keep.
      const update = {
        version: '6.4.2',
        addToPackageJson: 'devDependencies' as const,
      };
      const result = filterDowngradedUpdates(
        { vite: update },
        createPackageJson({ devDependencies: { vite: '^6.0.0' } }),
        () => '6.4.2'
      );

      expect(result).toEqual({ vite: update });
    });

    it('should drop no-op rewrites where the specifier is already exact at resolved', () => {
      // user has `react: 19.0.0` exact, resolved 19.0.0. Cascade proposes `19.0.0`.
      // Specifier floor is 19.0.0 === resolved 19.0.0 → no-op → drop.
      const result = filterDowngradedUpdates(
        {
          react: { version: '19.0.0', addToPackageJson: 'dependencies' },
        },
        createPackageJson({ dependencies: { react: '19.0.0' } }),
        () => '19.0.0'
      );

      expect(result).toEqual({});
    });

    it('should drop equal-version rewrites when the package has no specifier in package.json', () => {
      // No specifier means there is nothing to narrow; the equal-version write
      // would just add a new entry that the user never declared. Drop.
      const result = filterDowngradedUpdates(
        {
          'orphan-dep': {
            version: '1.0.0',
            addToPackageJson: 'dependencies',
          },
        },
        createPackageJson({}),
        () => '1.0.0'
      );

      expect(result).toEqual({});
    });

    it('should drop downgrades even when the specifier covers the proposed version', () => {
      // user has `vite: ^6.0.0`, resolved 6.4.2. Cascade proposes `6.2.0`.
      // Specifier floor 6.0.0 covers 6.2.0, but resolved 6.4.2 > proposed.
      // Real installed would regress → drop.
      const result = filterDowngradedUpdates(
        {
          vite: { version: '6.2.0', addToPackageJson: 'devDependencies' },
        },
        createPackageJson({ devDependencies: { vite: '^6.0.0' } }),
        () => '6.4.2'
      );

      expect(result).toEqual({});
    });

    it('should compare via normalizeVersion so prerelease tags do not block bumps', () => {
      const update = {
        version: '1.0.0',
        addToPackageJson: 'dependencies' as const,
      };
      const result = filterDowngradedUpdates(
        { pkg: update },
        createPackageJson({ dependencies: { pkg: '1.0.0-beta-next.2' } }),
        () => '1.0.0-beta-next.2'
      );

      expect(result).toEqual({ pkg: update });
    });

    it('should keep narrowing rewrites when the specifier is a tilde range covering a lower version', () => {
      // user has `vite: ~6.2.0`, resolved 6.2.5. Cascade proposes `6.2.5` (exact).
      // Tilde floor is 6.2.0 < resolved 6.2.5 → narrowing → keep.
      const update = {
        version: '6.2.5',
        addToPackageJson: 'devDependencies' as const,
      };
      const result = filterDowngradedUpdates(
        { vite: update },
        createPackageJson({ devDependencies: { vite: '~6.2.0' } }),
        () => '6.2.5'
      );

      expect(result).toEqual({ vite: update });
    });

    it('should drop no-op rewrites when a tilde range is already pinned to resolved', () => {
      // user has `vite: ~6.2.5`, resolved 6.2.5. Cascade proposes `6.2.5`.
      // Tilde floor 6.2.5 === resolved 6.2.5 → no-op → drop.
      const result = filterDowngradedUpdates(
        {
          vite: { version: '6.2.5', addToPackageJson: 'devDependencies' },
        },
        createPackageJson({ devDependencies: { vite: '~6.2.5' } }),
        () => '6.2.5'
      );

      expect(result).toEqual({});
    });

    it('should drop downgrades inside a tilde range', () => {
      // user has `vite: ~6.2.0`, resolved 6.2.7. Cascade proposes `6.2.3`.
      // Tilde floor 6.2.0 covers 6.2.3, but resolved 6.2.7 > proposed → drop.
      const result = filterDowngradedUpdates(
        {
          vite: { version: '6.2.3', addToPackageJson: 'devDependencies' },
        },
        createPackageJson({ devDependencies: { vite: '~6.2.0' } }),
        () => '6.2.7'
      );

      expect(result).toEqual({});
    });

    it('should drop equal-version rewrites for peer-deps-only packages (no dep/devDep specifier)', () => {
      // `peerDependencies` is intentionally not considered — only direct
      // dependencies / devDependencies count as a specifier. A package present
      // only as a peer dep behaves like an unspecified package: equal-version
      // rewrites become orphan writes and are dropped.
      const result = filterDowngradedUpdates(
        {
          'peer-only': { version: '5.0.0', addToPackageJson: 'dependencies' },
        },
        createPackageJson({ peerDependencies: { 'peer-only': '^5.0.0' } }),
        () => '5.0.0'
      );

      expect(result).toEqual({});
    });

    it('should not narrow non-range specifiers (workspace:/npm:/git/file)', () => {
      const nonSemverSpecifiers = [
        'workspace:*',
        'workspace:^',
        'npm:@scope/alias@^1.0.0',
        'git+https://github.com/owner/repo.git',
        'file:../local-pkg',
      ];

      for (const specifier of nonSemverSpecifiers) {
        const result = filterDowngradedUpdates(
          { pkg: { version: '1.0.0', addToPackageJson: 'dependencies' } },
          createPackageJson({ dependencies: { pkg: specifier } }),
          () => '1.0.0'
        );

        expect(result).toEqual({});
      }
    });
  });

  describe('resolveCatalogSpecifiers', () => {
    it('returns null when given null', () => {
      expect(resolveCatalogSpecifiers(null)).toBeNull();
    });

    it('passes plain semver specifiers through unchanged', () => {
      const packageJson = createPackageJson({
        dependencies: { react: '^18.0.0' },
        devDependencies: { vite: '~6.2.0' },
      });

      const result = resolveCatalogSpecifiers(packageJson);

      expect(result?.dependencies).toEqual({ react: '^18.0.0' });
      expect(result?.devDependencies).toEqual({ vite: '~6.2.0' });
    });

    it('leaves an unresolvable catalog reference as-is instead of throwing', () => {
      // Unresolvable catalog entry: preserved rather than throwing.
      const packageJson = createPackageJson({
        dependencies: { 'nonexistent-pkg-xyz': 'catalog:does-not-exist' },
      });

      const run = () => resolveCatalogSpecifiers(packageJson);

      expect(run).not.toThrow();
      expect(run()?.dependencies).toEqual({
        'nonexistent-pkg-xyz': 'catalog:does-not-exist',
      });
    });
  });

  describe('isNpmPeerDepsError', () => {
    it('should detect the npm 7-9 ERESOLVE code line', () => {
      const stderr = [
        'npm ERR! code ERESOLVE',
        'npm ERR! ERESOLVE unable to resolve dependency tree',
      ].join('\n');
      expect(isNpmPeerDepsError(stderr)).toBe(true);
    });

    it('should detect the npm 10+ ERESOLVE code line', () => {
      const stderr = [
        'npm error code ERESOLVE',
        'npm error ERESOLVE could not resolve',
      ].join('\n');
      expect(isNpmPeerDepsError(stderr)).toBe(true);
    });

    it('should fall back to phrase matching when ERESOLVE is absent', () => {
      expect(
        isNpmPeerDepsError('npm ERR! Unable to resolve dependency tree')
      ).toBe(true);
      expect(
        isNpmPeerDepsError('Could not resolve dependency: peer react@"^18"')
      ).toBe(true);
      expect(
        isNpmPeerDepsError('Conflicting peer dependency: typescript@5.0.0')
      ).toBe(true);
    });

    it('should not match unrelated npm errors', () => {
      expect(
        isNpmPeerDepsError('npm ERR! code ENOENT\nnpm ERR! path ./missing')
      ).toBe(false);
      expect(
        isNpmPeerDepsError(
          'network timeout fetching https://registry.npmjs.org'
        )
      ).toBe(false);
      expect(isNpmPeerDepsError('')).toBe(false);
    });

    it('should not match substrings of unrelated words', () => {
      // `\bERESOLVE\b` must not match arbitrary identifiers that merely contain
      // the letters (e.g. a hypothetical "PREERESOLVED" token).
      expect(isNpmPeerDepsError('some PREERESOLVED cache entry')).toBe(false);
    });
  });

  describe('minimum-release-age violation propagation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function violation() {
      return new MinReleaseAgeViolationError({
        packageManager: 'npm',
        packageName: 'mypackage',
        spec: 'latest',
        // npm's headline contains "No matching version", which the Migrator
        // catch would otherwise rewrap into a plain Error and lose the type.
        pmShapedDetail:
          'No matching version found for mypackage@latest with a date before 2020.',
        blocked: [],
        remediation: [
          'Wait until a matching version is older than the window.',
        ],
      });
    }

    it('the Migrator rethrows a cooldown violation without rewrapping it', async () => {
      const err = violation();
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () => Promise.reject(err),
        from: {},
        to: {},
      });
      await expect(migrator.migrate('mypackage', '2.0.0')).rejects.toBe(err);
    });

    it('the fetcher surfaces a cooldown violation instead of falling back to install', async () => {
      const err = violation();
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockRejectedValue(err);
      const fetch = createFetcher({} as any);
      await expect(fetch('mypackage', 'latest')).rejects.toBe(err);
    });
  });

  describe('multi-major migration prompt', () => {
    let originalCi: string | undefined;
    const originalTtyDescriptor = Object.getOwnPropertyDescriptor(
      process.stdin,
      'isTTY'
    );
    let originalMultiMajorMode: string | undefined;

    beforeEach(() => {
      originalCi = process.env.CI;
      originalMultiMajorMode = process.env.NX_MULTI_MAJOR_MODE;
      mockGetInstalledNxVersion.mockReturnValue('21.0.0');
      mockGetInstalledVersion.mockImplementation((pkg: string) =>
        pkg === 'nx' || pkg === '@nx/workspace'
          ? mockGetInstalledNxVersion()
          : null
      );
      mockGetInstalledPackageGroup.mockReturnValue(
        new Set(['nx', '@nx/js', '@nx/workspace'])
      );
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(null);
      delete process.env.CI;
      delete process.env.NX_MULTI_MAJOR_MODE;
    });

    afterEach(() => {
      mockGetInstalledNxVersion.mockReset();
      mockGetInstalledVersion.mockReset();
      mockGetInstalledPackageGroup.mockReset();
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReset();
      mockPrompt.mockReset();
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
      if (originalMultiMajorMode === undefined) {
        delete process.env.NX_MULTI_MAJOR_MODE;
      } else {
        process.env.NX_MULTI_MAJOR_MODE = originalMultiMajorMode;
      }
      if (originalTtyDescriptor) {
        Object.defineProperty(process.stdin, 'isTTY', originalTtyDescriptor);
      } else {
        delete (process.stdin as { isTTY?: boolean }).isTTY;
      }
      jest.restoreAllMocks();
    });

    function setTty(value: boolean) {
      Object.defineProperty(process.stdin, 'isTTY', {
        value,
        configurable: true,
      });
    }

    function mockRegistry(map: { latest?: string } & Record<string, string>) {
      jest
        .spyOn(packageMgrUtils, 'resolvePackageVersionUsingRegistry')
        .mockImplementation((_pkg, version) => {
          const v = String(version);
          if (v in map) return Promise.resolve(map[v]!);
          const match = v.match(/^\^(\d+)\.0\.0$/);
          if (match && map[match[1]]) return Promise.resolve(map[match[1]]!);
          if (match) return Promise.reject(new Error('none'));
          return Promise.resolve(v);
        });
    }

    function spyWarn() {
      return jest
        .spyOn(require('../../utils/output').output, 'warn')
        .mockImplementation(() => {});
    }

    // Every scenario here migrates a target that supports optional updates; the stub satisfies
    // the `--include` gate so the tests exercise multi-major resolution alone.
    const parseWithIncludes = (options: { [k: string]: any }) =>
      parseMigrationsOptions(options, includeGateFetch());

    it('should prompt and replace targetVersion with the chosen value (inferred target, TTY)', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        next: '23.1.0',
        canary: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '21.5.3' });

      const r = await parseWithIncludes({
        packageAndVersion: 'next',
        include: 'all',
      });

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          name: 'chosen',
          message: 'How would you like to proceed?',
          choices: expect.arrayContaining([
            expect.objectContaining({ name: '21.5.3' }),
            expect.objectContaining({ name: '22.5.3' }),
            expect.objectContaining({ name: '23.1.0' }),
          ]),
        })
      );
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetVersion: '21.5.3',
      });
    });

    it('should not include the current-major option when installed is already at latest of current major', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('21.5.3');
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '22.5.3' });

      await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      const promptArgs = mockPrompt.mock.calls[0][0];
      const choices = promptArgs.choices as { name: string }[];
      expect(choices.map((c) => c.name)).toEqual(['22.5.3', '23.1.0']);
    });

    it('should not include the current-major option when installed is on the latest minor of the current major but behind on patch', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('21.5.0');
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '22.5.3' });

      await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      const promptArgs = mockPrompt.mock.calls[0][0];
      const choices = promptArgs.choices as { name: string }[];
      expect(choices.map((c) => c.name)).toEqual(['22.5.3', '23.1.0']);
    });

    it('should omit the current-major (v22) step from the multi-major prompt', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      mockRegistry({
        latest: '24.1.0',
        '22': '22.5.3',
        '23': '23.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '23.5.3' });

      await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      const promptArgs = mockPrompt.mock.calls[0][0];
      const choices = promptArgs.choices as { name: string }[];
      // The 22.x current-major step is suppressed; only next-major and direct.
      expect(choices.map((c) => c.name)).toEqual(['23.5.3', '24.1.0']);
    });

    it('should keep --include=required valid when multi-major redirects to the next major (v22 install)', async () => {
      // Include is resolved before multi-major; suppressing the v22 step guarantees
      // every multi-major option stays >= v23, so a required selection can't
      // be invalidated by the redirect.
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      mockRegistry({
        latest: '24.1.0',
        '22': '22.5.3',
        '23': '23.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '23.5.3' });

      const r = await parseWithIncludes({
        packageAndVersion: 'nx@24.0.0',
        include: 'required',
      });

      expect(r).toMatchObject({
        type: 'generateMigrations',
        include: 'required',
        targetVersion: '23.5.3',
      });
    });

    it('should prompt (not warn) when target was explicitly typed as numeric semver', async () => {
      setTty(true);
      mockRegistry({
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '21.5.3' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'nx@23.1.0',
        include: 'all',
      });

      expect(mockPrompt).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '21.5.3' });
    });

    it('should warn (not prompt) in non-TTY environments', async () => {
      setTty(false);
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should warn (not prompt) when --no-interactive is passed in a TTY', async () => {
      setTty(true);
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        interactive: false,
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should not prompt or warn when --multi-major-mode=direct is set', async () => {
      setTty(true);
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'direct',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should not prompt or warn when NX_MULTI_MAJOR_MODE=direct is set', async () => {
      setTty(true);
      process.env.NX_MULTI_MAJOR_MODE = 'direct';
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should pick the latest in current major and skip prompts/warns when --multi-major-mode=gradual is set', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'gradual',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '21.5.3' });
    });

    it('should fall back to the next major when the current-major option is filtered out under --multi-major-mode=gradual', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('21.5.3');
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'gradual',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '22.5.3' });
    });

    it('should warn and fall back to the requested target when --multi-major-mode=gradual has no incremental option', async () => {
      setTty(true);
      // Installed at latest of its major → current-major option dropped.
      // Next-major lookup fails → next-major option dropped. Both unavailable.
      mockGetInstalledNxVersion.mockReturnValue('21.5.3');
      mockRegistry({ latest: '23.1.0', '21': '21.5.3' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'gradual',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(
            'Could not look up incremental migration options for --multi-major-mode=gradual'
          ),
        })
      );
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should honour NX_MULTI_MAJOR_MODE=gradual when no flag is set', async () => {
      setTty(true);
      process.env.NX_MULTI_MAJOR_MODE = 'gradual';
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '21.5.3' });
    });

    it('should let the flag win over the env var (flag=direct, env=gradual)', async () => {
      setTty(true);
      process.env.NX_MULTI_MAJOR_MODE = 'gradual';
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'direct',
      });

      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should bypass --multi-major-mode=gradual when --include=optional', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      // the `optional` value anchors at the installed canonical (here 23.0.0) and
      // must not be redirected to an incremental target. `maybePromptOrWarn…`
      // early-returns on `include === 'optional'` before consulting gradual,
      // so the flag is accepted but is a no-op.
      mockRegistry({
        latest: '25.1.0',
        '23': '23.5.3',
        '24': '24.5.3',
      });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'nx@23.0.0',
        include: 'optional',
        multiMajorMode: 'gradual',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.0.0' });
    });

    it('should not prompt or warn when delta is exactly 1 major', async () => {
      setTty(true);
      mockRegistry({ latest: '22.5.3' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '22.5.3' });
    });

    it('should not prompt or warn when installed is legacy-era (< 14)', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('13.10.0');
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should not prompt or warn for --include=optional', async () => {
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('23.0.0');
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({ include: 'optional' });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ include: 'optional' });
    });

    it.each(['nx', '@nx/workspace'])(
      'should resolve bare-package-name positional `%s` and fire the prompt',
      async (positional) => {
        // Regression: `nx migrate nx` and `nx migrate @nx/workspace` previously
        // bypassed the multi-major check because parseTargetPackageAndVersion
        // leaves targetVersion as the literal 'latest' for bare-package-name
        // input.
        setTty(true);
        mockRegistry({
          latest: '23.1.0',
          '21': '21.5.3',
          '22': '22.5.3',
        });
        mockPrompt.mockResolvedValue({ chosen: '21.5.3' });

        const r = await parseWithIncludes({
          packageAndVersion: positional,
          include: 'all',
        });

        expect(mockPrompt).toHaveBeenCalled();
        expect(r).toMatchObject({
          type: 'generateMigrations',
          targetVersion: '21.5.3',
        });
      }
    );

    it('should warn (not prompt) when next-major lookup fails and current-major option is unavailable', async () => {
      setTty(true);
      // Installed at latest of its major → current-major option dropped.
      // Next-major lookup fails → next-major option dropped. Both
      // unavailable → fall back to warn.
      mockGetInstalledNxVersion.mockReturnValue('21.5.3');
      mockRegistry({ latest: '23.1.0', '21': '21.5.3' });
      const warnSpy = spyWarn();

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should set originalTargetVersion when gradual mode redirects to an incremental step', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'gradual',
      });

      expect(r).toMatchObject({
        targetVersion: '21.5.3',
        originalTargetVersion: '23.1.0',
      });
    });

    it('should set originalTargetVersion when the interactive prompt picks an incremental step', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '22.5.3' });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(r).toMatchObject({
        targetVersion: '22.5.3',
        originalTargetVersion: '23.1.0',
      });
    });

    it('should leave originalTargetVersion undefined when the interactive prompt picks the requested target', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '23.1.0' });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(r).toMatchObject({ targetVersion: '23.1.0' });
      expect(
        (r as { originalTargetVersion?: string }).originalTargetVersion
      ).toBeUndefined();
    });

    it('should leave originalTargetVersion undefined under --multi-major-mode=direct', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'direct',
      });

      expect(r).toMatchObject({ targetVersion: '23.1.0' });
      expect(
        (r as { originalTargetVersion?: string }).originalTargetVersion
      ).toBeUndefined();
    });

    it('should leave originalTargetVersion undefined for bare invocations within a single-major delta', async () => {
      // Regression guard: dist-tag resolution alone (target == installed
      // after resolving 'latest') must not be treated as a redirect, or
      // Next Steps would suggest re-running toward the version the user
      // already landed on.
      setTty(true);
      mockGetInstalledNxVersion.mockReturnValue('22.5.3');
      mockRegistry({ latest: '22.5.3' });

      const bare = await parseWithIncludes({ include: 'all' });
      expect(bare).toMatchObject({ targetVersion: '22.5.3' });
      expect(
        (bare as { originalTargetVersion?: string }).originalTargetVersion
      ).toBeUndefined();

      const barePkg = await parseWithIncludes({
        packageAndVersion: 'nx',
        include: 'all',
      });
      expect(barePkg).toMatchObject({ targetVersion: '22.5.3' });
      expect(
        (barePkg as { originalTargetVersion?: string }).originalTargetVersion
      ).toBeUndefined();
    });

    it('should propagate gradual to multiMajorMode when gradual mode redirects', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
        multiMajorMode: 'gradual',
      });

      expect(r).toMatchObject({
        targetVersion: '21.5.3',
        originalTargetVersion: '23.1.0',
        multiMajorMode: 'gradual',
      });
    });

    it('should NOT propagate gradual to multiMajorMode when the interactive prompt picks an incremental step', async () => {
      setTty(true);
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '22.5.3' });

      const r = await parseWithIncludes({
        packageAndVersion: 'latest',
        include: 'all',
      });

      expect(r).toMatchObject({
        targetVersion: '22.5.3',
        originalTargetVersion: '23.1.0',
      });
      expect((r as { multiMajorMode?: string }).multiMajorMode).toBeUndefined();
    });
  });

  describe('prompt-bearing migrations', () => {
    it('should expose resolved prompt content via promptContents keyed by package and prompt path', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { '@nx/expo': '1.0.0' },
        }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () =>
          Promise.resolve({
            version: '2.0.0',
            generators: {
              'ai-instructions': {
                version: '2.0.0',
                description: 'AI prompt only',
                prompt: './files/ai-instructions.md',
              },
            },
            resolvedPromptFiles: {
              './files/ai-instructions.md': 'PROMPT BODY',
            },
          } as ResolvedMigrationConfiguration),
        from: {},
        to: {},
      });

      const result = await migrator.migrate('@nx/expo', '2.0.0');
      expect(result.migrations).toEqual([
        {
          version: '2.0.0',
          name: 'ai-instructions',
          package: '@nx/expo',
          description: 'AI prompt only',
          prompt: './files/ai-instructions.md',
        },
      ]);
      expect(result.promptContents).toEqual({
        '@nx/expo::./files/ai-instructions.md': 'PROMPT BODY',
      });
    });

    // Regression guard: `documentation` rides through `createMigrateJson`'s
    // spread untyped (GeneratedMigrationDetails treats it as optional and the
    // generated migrations.json is written via an `as any` cast), so a future
    // refactor could silently drop it from the generated file with no type
    // error. This test fails if that happens.
    it('should preserve the documentation field on migration entries', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { pkg: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () =>
          Promise.resolve({
            version: '2.0.0',
            generators: {
              documented: {
                version: '2.0.0',
                description: 'documented migration',
                implementation: './migrations/documented',
                documentation: './src/migrations/update-2-0-0/documented.md',
              },
            },
          } as ResolvedMigrationConfiguration),
        from: {},
        to: {},
      });

      const result = await migrator.migrate('pkg', '2.0.0');
      expect(result.migrations[0]).toMatchObject({
        name: 'documented',
        documentation: './src/migrations/update-2-0-0/documented.md',
      });
    });

    it('should preserve both prompt and implementation on hybrid entries', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { pkg: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () =>
          Promise.resolve({
            version: '2.0.0',
            generators: {
              hybrid: {
                version: '2.0.0',
                description: 'hybrid',
                implementation: './migrations/hybrid',
                prompt: './files/hybrid.md',
              },
            },
            resolvedPromptFiles: {
              './files/hybrid.md': 'HYBRID',
            },
          } as ResolvedMigrationConfiguration),
        from: {},
        to: {},
      });

      const result = await migrator.migrate('pkg', '2.0.0');
      expect(result.migrations[0]).toMatchObject({
        implementation: './migrations/hybrid',
        prompt: './files/hybrid.md',
      });
      expect(result.promptContents).toEqual({
        'pkg::./files/hybrid.md': 'HYBRID',
      });
    });

    it('should omit promptContents from the result when no prompts were resolved', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { pkg: '1.0.0' } }),
        getInstalledPackageVersion: () => '1.0.0',
        fetch: () =>
          Promise.resolve({
            version: '2.0.0',
            generators: {
              one: {
                version: '2.0.0',
                description: 'plain',
                implementation: './migrations/one',
              },
            },
          } as ResolvedMigrationConfiguration),
        from: {},
        to: {},
      });

      const result = await migrator.migrate('pkg', '2.0.0');
      expect(result).not.toHaveProperty('promptContents');
    });
  });

  describe('validateMigrationEntries', () => {
    it('should not throw when all entries have at least one of implementation/factory/prompt', () => {
      expect(() =>
        validateMigrationEntries('@nx/x', '2.0.0', {
          generators: {
            a: { version: '2.0.0', implementation: './a' },
            b: { version: '2.0.0', factory: './b' },
            c: { version: '2.0.0', prompt: './c.md' },
          },
        })
      ).not.toThrow();
    });

    it('should throw when an entry has none of implementation/factory/prompt', () => {
      expect(() =>
        validateMigrationEntries('@nx/x', '2.0.0', {
          generators: {
            broken: { version: '2.0.0', description: 'oops' },
          },
        })
      ).toThrow(
        /Invalid migration "broken" in package "@nx\/x@2\.0\.0": migration entries must have at least one of "implementation", "factory", or "prompt"\./
      );
    });

    it('should validate entries from both generators and schematics', () => {
      expect(() =>
        validateMigrationEntries('pkg', '1.0.0', {
          schematics: {
            broken: { version: '1.0.0' },
          },
        })
      ).toThrow(/Invalid migration "broken" in package "pkg@1\.0\.0"/);
    });
  });

  describe('prompt path traversal', () => {
    it.each([
      ['../../etc/passwd'],
      ['./safe/../../escape.md'],
      ['/etc/passwd'],
    ])(
      'should reject prompt path %p that escapes the migrations directory',
      async (badPath) => {
        await expect(
          readPromptFilesFromInstall(
            'pkg',
            '1.0.0',
            {
              generators: {
                m: { version: '1.0.0', prompt: badPath },
              },
            },
            '/tmp/fake-pkg/migrations.json'
          )
        ).rejects.toThrow(/Invalid prompt path/);
      }
    );
  });

  describe('writePromptMigrationFiles', () => {
    let tmpRoot: string;

    beforeEach(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), 'nx-prompt-migrations-'));
    });

    afterEach(() => {
      rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('should write prompt files under the package and target version directories using the basename', () => {
      const migrations = [
        {
          package: '@nx/expo',
          name: 'm',
          version: '22.2.0-beta.3',
          prompt:
            './src/migrations/update-22-2-0/files/ai-instructions-for-expo-54.md',
        },
      ];
      const promptContents = {
        '@nx/expo::./src/migrations/update-22-2-0/files/ai-instructions-for-expo-54.md':
          'EXPO',
      };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '22.5.0'
      );

      const expectedPath =
        'tools/ai-migrations/@nx/expo/22.5.0/ai-instructions-for-expo-54.md';
      expect(written).toEqual([expectedPath]);
      expect(migrations[0].prompt).toBe(expectedPath);
      expect(readFileSync(join(tmpRoot, expectedPath), 'utf-8')).toBe('EXPO');
    });

    it('should write under the package directory when unscoped', () => {
      const migrations = [
        {
          package: 'mypackage',
          name: 'm',
          version: '1.0.0',
          prompt: './files/foo.md',
        },
      ];
      const promptContents = { 'mypackage::./files/foo.md': 'X' };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '1.0.0'
      );

      expect(written).toEqual(['tools/ai-migrations/mypackage/1.0.0/foo.md']);
    });

    it('should write a single file when two entries reference the same source .md', () => {
      const migrations = [
        {
          package: '@nx/vitest',
          name: 'a',
          version: '22.1.0-beta.8',
          prompt: './files/ai-instructions-for-vitest-4.md',
        },
        {
          package: '@nx/vitest',
          name: 'b',
          version: '22.3.2-beta.0',
          prompt: './files/ai-instructions-for-vitest-4.md',
        },
      ];
      const promptContents = {
        '@nx/vitest::./files/ai-instructions-for-vitest-4.md': 'V',
      };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '22.4.0'
      );

      const expectedPath =
        'tools/ai-migrations/@nx/vitest/22.4.0/ai-instructions-for-vitest-4.md';
      expect(written).toEqual([expectedPath]);
      expect(migrations[0].prompt).toBe(expectedPath);
      expect(migrations[1].prompt).toBe(expectedPath);
      expect(readFileSync(join(tmpRoot, expectedPath), 'utf-8')).toBe('V');
    });

    it('should suffix the basename when two entries have different content but the same basename', () => {
      const migrations = [
        {
          package: 'pkg',
          name: 'a',
          version: '1.0.0',
          prompt: './a/foo.md',
        },
        {
          package: 'pkg',
          name: 'b',
          version: '1.0.0',
          prompt: './b/foo.md',
        },
      ];
      const promptContents = {
        'pkg::./a/foo.md': 'A',
        'pkg::./b/foo.md': 'B',
      };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '2.0.0'
      );

      expect(written).toEqual([
        'tools/ai-migrations/pkg/2.0.0/foo.md',
        'tools/ai-migrations/pkg/2.0.0/foo-1.md',
      ]);
      expect(migrations[0].prompt).toBe('tools/ai-migrations/pkg/2.0.0/foo.md');
      expect(migrations[1].prompt).toBe(
        'tools/ai-migrations/pkg/2.0.0/foo-1.md'
      );
      expect(
        readFileSync(
          join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0/foo.md'),
          'utf-8'
        )
      ).toBe('A');
      expect(
        readFileSync(
          join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0/foo-1.md'),
          'utf-8'
        )
      ).toBe('B');
    });

    it('should reuse an existing on-disk file when its content is identical', () => {
      const existing = join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0/foo.md');
      mkdirSync(dirname(existing), { recursive: true });
      writeFileSync(existing, 'SAME');

      const migrations = [
        {
          package: 'pkg',
          name: 'm',
          version: '1.0.0',
          prompt: './files/foo.md',
        },
      ];
      const promptContents = { 'pkg::./files/foo.md': 'SAME' };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '2.0.0'
      );

      expect(written).toEqual([]);
      expect(migrations[0].prompt).toBe('tools/ai-migrations/pkg/2.0.0/foo.md');
      expect(readFileSync(existing, 'utf-8')).toBe('SAME');
    });

    it('should suffix when an existing on-disk file has different content', () => {
      const existing = join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0/foo.md');
      mkdirSync(dirname(existing), { recursive: true });
      writeFileSync(existing, 'OLD');

      const migrations = [
        {
          package: 'pkg',
          name: 'm',
          version: '1.0.0',
          prompt: './files/foo.md',
        },
      ];
      const promptContents = { 'pkg::./files/foo.md': 'NEW' };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '2.0.0'
      );

      expect(written).toEqual(['tools/ai-migrations/pkg/2.0.0/foo-1.md']);
      expect(migrations[0].prompt).toBe(
        'tools/ai-migrations/pkg/2.0.0/foo-1.md'
      );
      expect(readFileSync(existing, 'utf-8')).toBe('OLD');
      expect(
        readFileSync(
          join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0/foo-1.md'),
          'utf-8'
        )
      ).toBe('NEW');
    });

    it('should walk past existing suffixed files until it finds a free or content-matching slot', () => {
      const dir = join(tmpRoot, 'tools/ai-migrations/pkg/2.0.0');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'foo.md'), 'A');
      writeFileSync(join(dir, 'foo-1.md'), 'B');

      const migrations = [
        {
          package: 'pkg',
          name: 'm',
          version: '1.0.0',
          prompt: './files/foo.md',
        },
      ];
      const promptContents = { 'pkg::./files/foo.md': 'C' };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '2.0.0'
      );

      expect(written).toEqual(['tools/ai-migrations/pkg/2.0.0/foo-2.md']);
      expect(migrations[0].prompt).toBe(
        'tools/ai-migrations/pkg/2.0.0/foo-2.md'
      );
      expect(readFileSync(join(dir, 'foo-2.md'), 'utf-8')).toBe('C');
    });

    it('should ignore entries whose prompt content is missing from the map', () => {
      const migrations = [
        { package: 'pkg', name: 'a', version: '1.0.0' },
        {
          package: 'pkg',
          name: 'b',
          version: '1.0.0',
          prompt: './missing.md',
        },
        {
          package: 'pkg',
          name: 'c',
          version: '1.0.0',
          prompt: './x.md',
        },
      ];
      const promptContents = { 'pkg::./x.md': 'X' };

      const written = writePromptMigrationFiles(
        tmpRoot,
        migrations,
        promptContents,
        '1.0.0'
      );
      expect(written).toEqual(['tools/ai-migrations/pkg/1.0.0/x.md']);
    });
  });

  describe('agentic helpers', () => {
    const baseMigration = { package: 'p', name: 'n', version: '1.0.0' };

    describe('isPromptOnlyMigration / isHybridMigration', () => {
      it.each([
        ['prompt only', { prompt: 'x.md' }, true, false],
        [
          'prompt + implementation (hybrid)',
          { prompt: 'x.md', implementation: './impl.js' },
          false,
          true,
        ],
        [
          'prompt + legacy factory (hybrid)',
          { prompt: 'x.md', factory: './factory.js' },
          false,
          true,
        ],
        [
          'implementation only (no prompt)',
          { implementation: './impl.js' },
          false,
          false,
        ],
      ])(
        'classifies %s correctly',
        (_label, extra, expectedPromptOnly, expectedHybrid) => {
          const migration = { ...baseMigration, ...extra };
          expect(isPromptOnlyMigration(migration)).toBe(expectedPromptOnly);
          expect(isHybridMigration(migration)).toBe(expectedHybrid);
        }
      );
    });

    describe('resolveCreateCommits', () => {
      it.each<
        [
          string,
          boolean | undefined,
          'disabled' | 'inside-agent' | 'enabled',
          { effective: boolean; agenticHasDiffContext: boolean },
        ]
      >([
        [
          'explicit true, no agentic',
          true,
          'disabled',
          { effective: true, agenticHasDiffContext: false },
        ],
        [
          'explicit false, no agentic',
          false,
          'disabled',
          { effective: false, agenticHasDiffContext: false },
        ],
        [
          'unset, no agentic',
          undefined,
          'disabled',
          { effective: false, agenticHasDiffContext: false },
        ],
        [
          'unset, inside-agent',
          undefined,
          'inside-agent',
          { effective: false, agenticHasDiffContext: false },
        ],
        [
          'unset, agentic enabled — soft-force on',
          undefined,
          'enabled',
          { effective: true, agenticHasDiffContext: true },
        ],
        [
          'explicit true, agentic enabled',
          true,
          'enabled',
          { effective: true, agenticHasDiffContext: true },
        ],
      ])('git repo: %s', (_label, createCommits, agenticKind, expected) => {
        expect(
          resolveCreateCommits({
            createCommits,
            agenticKind,
            isGitRepo: true,
          })
        ).toEqual(expected);
      });

      it('warns and drops diff context when createCommits=false is explicit alongside agentic', () => {
        const result = resolveCreateCommits({
          createCommits: false,
          agenticKind: 'enabled',
          isGitRepo: true,
        });
        expect(result.effective).toBe(false);
        expect(result.agenticHasDiffContext).toBe(false);
        expect(result.warning).toMatch(/--no-create-commits/);
      });

      it('errors when --create-commits is explicit without a git repo', () => {
        const result = resolveCreateCommits({
          createCommits: true,
          agenticKind: 'disabled',
          isGitRepo: false,
        });
        expect(result.effective).toBe(false);
        expect(result.error).toMatch(
          /`--create-commits` requires a git repository/
        );
      });

      it('degrades agentic without git (createCommits unset): warns, no error, no diff context', () => {
        const result = resolveCreateCommits({
          createCommits: undefined,
          agenticKind: 'enabled',
          isGitRepo: false,
        });
        expect(result.effective).toBe(false);
        expect(result.agenticHasDiffContext).toBe(false);
        expect(result.error).toBeUndefined();
        expect(result.warning).toMatch(/not a git repository/);
      });

      it('notes the dropped --commit-prefix in the agentic-without-git warning when the prefix is customized', () => {
        const result = resolveCreateCommits({
          createCommits: undefined,
          agenticKind: 'enabled',
          isGitRepo: false,
          commitPrefixIsCustom: true,
        });
        expect(result.warning).toMatch(/--commit-prefix/);
        expect(result.warning).toMatch(/no effect/);
      });

      it('notes the dropped --commit-prefix in the --no-create-commits + agentic warning when the prefix is customized', () => {
        const result = resolveCreateCommits({
          createCommits: false,
          agenticKind: 'enabled',
          isGitRepo: true,
          commitPrefixIsCustom: true,
        });
        expect(result.warning).toMatch(/--no-create-commits/);
        expect(result.warning).toMatch(/--commit-prefix/);
        expect(result.warning).toMatch(/no effect/);
      });

      it('does not mention --commit-prefix when the prefix is unchanged', () => {
        const result = resolveCreateCommits({
          createCommits: undefined,
          agenticKind: 'enabled',
          isGitRepo: false,
          commitPrefixIsCustom: false,
        });
        expect(result.warning).not.toMatch(/--commit-prefix/);
      });

      it('warns that a configured commit prefix has no effect when commits stay disabled', () => {
        const result = resolveCreateCommits({
          createCommits: undefined,
          agenticKind: 'disabled',
          isGitRepo: true,
          commitPrefixIsCustom: true,
        });
        expect(result.effective).toBe(false);
        expect(result.warning).toMatch(/no effect/);
        expect(result.warning).toMatch(/createCommits/);
      });

      it('does not warn about the commit prefix when commits are disabled and the prefix is default', () => {
        const result = resolveCreateCommits({
          createCommits: undefined,
          agenticKind: 'disabled',
          isGitRepo: true,
          commitPrefixIsCustom: false,
        });
        expect(result.warning).toBeUndefined();
      });

      it('does not warn when commits are enabled even though the agentic flow is disabled', () => {
        const result = resolveCreateCommits({
          createCommits: true,
          agenticKind: 'disabled',
          isGitRepo: true,
          commitPrefixIsCustom: true,
        });
        expect(result.effective).toBe(true);
        expect(result.warning).toBeUndefined();
      });
    });

    describe('parseMigrationReturn', () => {
      it('reads both buckets from the object shape and tolerates partial shapes', () => {
        expect(
          parseMigrationReturn({
            nextSteps: ['a'],
            agentContext: ['b', 'c'],
          })
        ).toEqual({ nextSteps: ['a'], agentContext: ['b', 'c'] });
        expect(parseMigrationReturn({ agentContext: ['x'] })).toEqual({
          nextSteps: [],
          agentContext: ['x'],
        });
      });

      it('treats a string array as legacy workspace-wide nextSteps', () => {
        expect(parseMigrationReturn(['a', 'b'])).toEqual({
          nextSteps: ['a', 'b'],
          agentContext: [],
        });
      });

      it('filters non-string entries per bucket so a single bad entry does not drop the whole array', () => {
        expect(
          parseMigrationReturn({
            nextSteps: ['ok', 1, null] as any,
            agentContext: [true, 'ok'] as any,
          })
        ).toEqual({ nextSteps: ['ok'], agentContext: ['ok'] });
        expect(parseMigrationReturn(['ok', 42] as any)).toEqual({
          nextSteps: ['ok'],
          agentContext: [],
        });
      });
    });

    describe('formatSkippedPromptsNextStep', () => {
      it('renders a parent instruction line and an indented bullet per skipped path', () => {
        const result = formatSkippedPromptsNextStep([
          {
            package: '@nx/storybook',
            name: 'migrate-css',
            version: '9.2.0',
            prompt: 'tools/ai-migrations/@nx/storybook/9.2.0/migrate-css.md',
          },
          {
            package: '@nx/rspack',
            name: 'perf-options',
            version: '2.0.0',
            prompt: 'tools/ai-migrations/@nx/rspack/2.0.0/perf-options.md',
          },
        ]);

        expect(result).toBe(
          'Some prompt migrations were skipped. Review and apply each of the following prompt files to the workspace, in the listed order:\n' +
            '  - tools/ai-migrations/@nx/storybook/9.2.0/migrate-css.md\n' +
            '  - tools/ai-migrations/@nx/rspack/2.0.0/perf-options.md'
        );
      });
    });
  });

  describe('resolveMigrationForRun', () => {
    let tmpRoot: string;
    let warnSpy: jest.SpyInstance;

    const writeInstalledPackage = (
      pkgName: string,
      documentationRelToMigrationsDir: string | null
    ) => {
      const pkgDir = join(tmpRoot, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({
          name: pkgName,
          version: '1.0.0',
          'nx-migrations': './migrations.json',
        })
      );
      writeFileSync(
        join(pkgDir, 'migrations.json'),
        JSON.stringify({ generators: {} })
      );
      if (documentationRelToMigrationsDir) {
        const docAbs = join(pkgDir, documentationRelToMigrationsDir);
        mkdirSync(dirname(docAbs), { recursive: true });
        writeFileSync(docAbs, '# doc');
      }
    };

    beforeEach(() => {
      // realpath so the workspace-relative assertion isn't defeated by the
      // macOS /tmp -> /private/tmp symlink (require.resolve returns realpaths).
      tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'nx-migration-docs-')));
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('resolves the documentation file to a workspace-relative node_modules path', () => {
      writeInstalledPackage('@nx/foo', './src/migrations/update-1-0-0/do.md');
      const { documentationPath } = resolveMigrationForRun(
        tmpRoot,
        {
          package: '@nx/foo',
          name: 'update-1-0-0',
          implementation: './src/migrations/update-1-0-0/do',
          documentation: './src/migrations/update-1-0-0/do.md',
        },
        true
      );
      expect(documentationPath).toBe(
        join('node_modules', '@nx/foo', 'src/migrations/update-1-0-0/do.md')
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('returns no documentation path (and does not warn) when none is declared', () => {
      writeInstalledPackage('@nx/foo', null);
      const { documentationPath } = resolveMigrationForRun(
        tmpRoot,
        {
          package: '@nx/foo',
          name: 'update-1-0-0',
          implementation: './src/migrations/update-1-0-0/do',
        },
        true
      );
      expect(documentationPath).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not resolve documentation for non-agentic runs', () => {
      writeInstalledPackage('@nx/foo', './src/migrations/update-1-0-0/do.md');
      const { documentationPath } = resolveMigrationForRun(
        tmpRoot,
        {
          package: '@nx/foo',
          name: 'update-1-0-0',
          implementation: './src/migrations/update-1-0-0/do',
          documentation: './src/migrations/update-1-0-0/do.md',
        },
        false
      );
      expect(documentationPath).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns and skips when a declared documentation file is not present', () => {
      writeInstalledPackage('@nx/foo', null);
      const { documentationPath } = resolveMigrationForRun(
        tmpRoot,
        {
          package: '@nx/foo',
          name: 'update-1-0-0',
          implementation: './src/migrations/update-1-0-0/do',
          documentation: './src/migrations/update-1-0-0/missing.md',
        },
        true
      );
      expect(documentationPath).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        './src/migrations/update-1-0-0/missing.md'
      );
    });

    it('throws when an implementation migration package cannot be resolved', () => {
      expect(() =>
        resolveMigrationForRun(
          tmpRoot,
          {
            package: '@nx/not-installed',
            name: 'update-1-0-0',
            implementation: './x',
            documentation: './x.md',
          },
          true
        )
      ).toThrow();
    });

    it('is non-fatal for prompt-only migrations when the package cannot be resolved', () => {
      const { documentationPath } = resolveMigrationForRun(
        tmpRoot,
        {
          package: '@nx/not-installed',
          name: 'update-1-0-0',
          prompt: './x.md',
          documentation: './x.md',
        },
        true
      );
      expect(documentationPath).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveDocumentationFileToWorkspacePath', () => {
    let tmpRoot: string;

    beforeEach(() => {
      tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'nx-doc-resolve-')));
    });

    afterEach(() => {
      rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('resolves a package-relative documentation path to a workspace-relative path', () => {
      const migrationsDir = join(tmpRoot, 'node_modules', '@nx/foo');
      const docAbs = join(migrationsDir, 'src/migrations/update-1-0-0/do.md');
      mkdirSync(dirname(docAbs), { recursive: true });
      writeFileSync(docAbs, '# doc');
      expect(
        resolveDocumentationFileToWorkspacePath(
          tmpRoot,
          migrationsDir,
          './src/migrations/update-1-0-0/do.md'
        )
      ).toBe(
        join('node_modules', '@nx/foo', 'src/migrations/update-1-0-0/do.md')
      );
    });

    it('returns undefined when the documentation file does not exist', () => {
      const migrationsDir = join(tmpRoot, 'node_modules', '@nx/foo');
      mkdirSync(migrationsDir, { recursive: true });
      expect(
        resolveDocumentationFileToWorkspacePath(
          tmpRoot,
          migrationsDir,
          './missing.md'
        )
      ).toBeUndefined();
    });
  });
});

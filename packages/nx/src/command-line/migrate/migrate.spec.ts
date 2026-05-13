const mocks = {
  prompt: jest.fn(),
  getInstalledNxVersion: jest.fn(),
  getInstalledNxPackageGroup: jest.fn(),
  getInstalledLegacyNrwlWorkspaceVersion: jest.fn(),
};
const mockPrompt = mocks.prompt;
const mockGetInstalledNxVersion = mocks.getInstalledNxVersion;
const mockGetInstalledNxPackageGroup = mocks.getInstalledNxPackageGroup;
const mockGetInstalledLegacyNrwlWorkspaceVersion =
  mocks.getInstalledLegacyNrwlWorkspaceVersion;
jest.mock('enquirer', () => ({
  prompt: (...args: any[]) => mocks.prompt(...args),
}));
jest.mock('../../utils/installed-nx-version', () => ({
  getInstalledNxVersion: () => mocks.getInstalledNxVersion(),
  getInstalledNxPackageGroup: () => mocks.getInstalledNxPackageGroup(),
  getInstalledLegacyNrwlWorkspaceVersion: () =>
    mocks.getInstalledLegacyNrwlWorkspaceVersion(),
}));
import { PackageJson } from '../../utils/package-json';
import * as packageMgrUtils from '../../utils/package-manager';

import {
  filterDowngradedUpdates,
  formatCommandFailure,
  isNpmPeerDepsError,
  Migrator,
  normalizeVersion,
  parseMigrationsOptions,
  ResolvedMigrationConfiguration,
  resolveCanonicalNxPackage,
  resolveMode,
} from './migrate';

const createPackageJson = (
  overrides: Partial<PackageJson> = {}
): PackageJson => ({
  name: 'some-workspace',
  version: '0.0.0',
  ...overrides,
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

    describe('--mode', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should keep first-party packages and drop third-party in mixed entries', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              firstPartyChild: '1.0.0',
              thirdPartyChild: '1.0.0',
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
                      firstPartyChild: { version: '3.0.0' },
                      thirdPartyChild: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'firstPartyChild') {
              return Promise.resolve({ version: '3.0.0' });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          mode: 'first-party',
          firstPartyPackages: new Set(['mypackage', 'firstPartyChild']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          mypackage: { version: '2.0.0', addToPackageJson: false },
          firstPartyChild: { version: '3.0.0', addToPackageJson: false },
        });
        expect(result.packageUpdates.thirdPartyChild).toBeUndefined();
      });

      it('should drop entries that contain only third-party packages without firing their x-prompt', async () => {
        mockPrompt.mockReturnValue(Promise.resolve({ shouldApply: true }));
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              thirdPartyA: '1.0.0',
              thirdPartyB: '1.0.0',
            },
          }),
          getInstalledPackageVersion: () => '1.0.0',
          fetch: (p) => {
            if (p === 'mypackage') {
              return Promise.resolve({
                version: '2.0.0',
                packageJsonUpdates: {
                  thirdPartyOnly: {
                    version: '2.0.0',
                    'x-prompt': 'Update third-party packages?',
                    packages: {
                      thirdPartyA: { version: '3.0.0' },
                      thirdPartyB: { version: '3.0.0' },
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
          mode: 'first-party',
          firstPartyPackages: new Set(['mypackage']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          mypackage: { version: '2.0.0', addToPackageJson: false },
        });
        expect(mockPrompt).not.toHaveBeenCalled();
      });

      it('should source first-party gate from the provided set, not getNxPackageGroup', async () => {
        // Sanity: a name commonly returned by getNxPackageGroup() that we
        // deliberately exclude from the first-party set should be filtered out,
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
          mode: 'first-party',
          firstPartyPackages: new Set(['nx', 'not-in-nx-package-group']),
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

      it('should drop first-party packages and keep third-party in mixed entries when mode is third-party', async () => {
        const migrator = new Migrator({
          packageJson: createPackageJson({
            dependencies: {
              firstPartyChild: '1.0.0',
              thirdPartyChild: '1.0.0',
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
                      firstPartyChild: { version: '3.0.0' },
                      thirdPartyChild: { version: '3.0.0' },
                    },
                  },
                },
              });
            } else if (p === 'firstPartyChild' || p === 'thirdPartyChild') {
              return Promise.resolve({ version: '3.0.0' });
            }
            return Promise.resolve(null);
          },
          from: {},
          to: {},
          mode: 'third-party',
          firstPartyPackages: new Set(['mypackage', 'firstPartyChild']),
        });

        const result = await migrator.migrate('mypackage', '2.0.0');

        expect(result.packageUpdates).toEqual({
          thirdPartyChild: { version: '3.0.0', addToPackageJson: false },
        });
        expect(result.packageUpdates.mypackage).toBeUndefined();
        expect(result.packageUpdates.firstPartyChild).toBeUndefined();
      });

      it.each(['first-party', 'third-party'] as const)(
        'should throw when constructed with mode=%s but no firstPartyPackages',
        (mode) => {
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
                mode,
              })
          ).toThrow(
            `Error: 'firstPartyPackages' is required when 'mode' is '${mode}'.`
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
    beforeEach(() => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      mockGetInstalledNxPackageGroup.mockReturnValue(
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
      mockGetInstalledNxPackageGroup.mockReset();
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReset();
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

    it('should reject --mode combined with --run-migrations', async () => {
      await expect(() =>
        parseMigrationsOptions({
          runMigrations: 'migrations.json',
          mode: 'first-party',
        })
      ).rejects.toThrow(
        `Error: '--mode' cannot be combined with '--run-migrations'.`
      );
    });

    it('should reject --mode for non-nx-equivalent target on modern versions', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '@nx/react@22.0.0',
          mode: 'first-party',
        })
      ).rejects.toThrow(
        `Error: '--mode' requires the target to be 'nx' or '@nx/workspace'. Got '@nx/react@22.0.0'.`
      );
    });

    it('should reject --mode for non-nx-equivalent target on legacy versions', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@13.0.0',
          mode: 'first-party',
        })
      ).rejects.toThrow(
        `Error: '--mode' requires the target to be '@nrwl/workspace' for Nx <14.0.0. Got 'nx@13.0.0'.`
      );
    });

    it('should reject --mode=third-party combined with --from', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          from: 'nx@21.0.0',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot be combined with '--from'.`
      );
    });

    it('should reject --mode=third-party combined with --exclude-applied-migrations', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          excludeAppliedMigrations: true,
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot be combined with '--exclude-applied-migrations'.`
      );
    });

    it.each([
      {
        desc: 'bare invocation, modern nx installed',
        positional: undefined,
        installedNx: '22.5.0',
        installedLegacy: null,
        expected: { targetPackage: 'nx', targetVersion: '22.5.0' },
      },
      {
        desc: 'bare invocation, only legacy @nrwl/workspace installed',
        positional: undefined,
        installedNx: null,
        installedLegacy: '13.5.0',
        expected: {
          targetPackage: '@nrwl/workspace',
          targetVersion: '13.5.0',
        },
      },
      {
        desc: 'bare invocation, installed nx is legacy (<14)',
        positional: undefined,
        installedNx: '13.5.0',
        installedLegacy: null,
        expected: {
          targetPackage: '@nrwl/workspace',
          targetVersion: '13.5.0',
        },
      },
      {
        desc: 'bare-package-name positional `nx`, modern nx installed',
        positional: 'nx',
        installedNx: '22.5.0',
        installedLegacy: null,
        expected: { targetPackage: 'nx', targetVersion: '22.5.0' },
      },
      {
        desc: 'bare-package-name positional `nx`, installed nx is legacy (<14)',
        positional: 'nx',
        installedNx: '13.5.0',
        installedLegacy: null,
        expected: {
          targetPackage: '@nrwl/workspace',
          targetVersion: '13.5.0',
        },
      },
    ])(
      'should anchor --mode=third-party to installed canonical: $desc',
      async ({ positional, installedNx, installedLegacy, expected }) => {
        mockGetInstalledNxVersion.mockReturnValue(installedNx);
        mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(
          installedLegacy
        );
        const r = await parseMigrationsOptions({
          ...(positional ? { packageAndVersion: positional } : {}),
          mode: 'third-party',
        });
        expect(r).toMatchObject({
          type: 'generateMigrations',
          mode: 'third-party',
          ...expected,
        });
      }
    );

    it('should reject --mode=third-party when nx is not installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue(null);
      await expect(() =>
        parseMigrationsOptions({ mode: 'third-party' })
      ).rejects.toThrow(
        `Error: '--mode=third-party' requires 'nx' (or '@nrwl/workspace' on Nx <14) to be installed in your workspace.`
      );
    });

    it('should reject --mode=third-party when target is higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@23.0.0',
          mode: 'third-party',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got 'nx@23.0.0', installed 'nx@22.0.0').`
      );
    });

    it('should accept --mode=third-party when target is lower than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.5.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@22.0.0',
        mode: 'third-party',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: 'nx',
        targetVersion: '22.0.0',
        mode: 'third-party',
      });
    });

    it('should accept --mode=third-party with @nx/workspace target, preserve typed target, and swap to nx canonical at walk time', async () => {
      // `parseMigrationsOptions` preserves the typed target verbatim; the
      // silent `@nx/workspace` → `nx` swap happens later in
      // `generateMigrationsJsonAndUpdatePackageJson` via
      // `resolveCanonicalNxPackage`.
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: '@nx/workspace@22.0.0',
        mode: 'third-party',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nx/workspace',
        targetVersion: '22.0.0',
        mode: 'third-party',
      });
      expect(
        resolveCanonicalNxPackage(
          (r as { targetVersion: string }).targetVersion
        )
      ).toBe('nx');
    });

    it('should reject --mode=third-party with --to canonical higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          to: 'nx@23.0.0',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '--to nx@23.0.0', installed 'nx@22.0.0').`
      );
    });

    it('should reject --mode=third-party with --to for first-party plugins higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          to: '@nx/js@22.6.4',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '--to @nx/js@22.6.4', installed 'nx@22.0.0').`
      );
    });

    it('should reject --mode=third-party with --to create-nx-workspace higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          to: 'create-nx-workspace@22.6.4',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '--to create-nx-workspace@22.6.4', installed 'nx@22.0.0').`
      );
    });

    it('should reject --mode=third-party with --to @nx/workspace higher than installed', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: 'nx@22.0.0',
          mode: 'third-party',
          to: '@nx/workspace@23.0.0',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '--to @nx/workspace@23.0.0', installed 'nx@22.0.0').`
      );
    });

    it('should accept --mode=third-party with --to for non-canonical packages', async () => {
      mockGetInstalledNxVersion.mockReturnValue('22.0.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@22.0.0',
        mode: 'third-party',
        to: 'react@18.0.0',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        mode: 'third-party',
        to: { react: '18.0.0' },
      });
    });

    it('should reject --mode=third-party for legacy target when @nrwl/workspace is not installed', async () => {
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(null);
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '@nrwl/workspace@13.0.0',
          mode: 'third-party',
        })
      ).rejects.toThrow(
        `Error: '--mode=third-party' requires '@nrwl/workspace' to be installed in your workspace.`
      );
    });

    it('should accept --mode=third-party for legacy target when @nrwl/workspace is installed', async () => {
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue('13.5.0');
      const r = await parseMigrationsOptions({
        packageAndVersion: '@nrwl/workspace@13.0.0',
        mode: 'third-party',
      });
      expect(r).toMatchObject({
        type: 'generateMigrations',
        targetPackage: '@nrwl/workspace',
        targetVersion: '13.0.0',
        mode: 'third-party',
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
  });

  describe('resolveMode', () => {
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

    it('should return the provided mode without prompting', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveMode('first-party', 'nx', '22.0.0');
      expect(result).toBe('first-party');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting in non-TTY environments', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveMode(undefined, 'nx', '22.0.0');
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting when running in CI', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'true';
      const result = await resolveMode(undefined, 'nx', '22.0.0');
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should default to "all" without prompting for non-nx-equivalent target', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      const result = await resolveMode(undefined, '@nx/react', '22.0.0');
      expect(result).toBe('all');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should prompt and return the selection in interactive TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ mode: 'first-party' }));
      const result = await resolveMode(undefined, 'nx', '22.0.0');
      expect(result).toBe('first-party');
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should include third-party in prompt choices by default', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ mode: 'all' }));
      await resolveMode(undefined, 'nx', '22.0.0');
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'first-party',
        'third-party',
        'all',
      ]);
    });

    it('should hide third-party from prompt choices when --from is provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ mode: 'all' }));
      await resolveMode(undefined, 'nx', '22.0.0', {
        hasFrom: true,
        hasExcludeAppliedMigrations: false,
      });
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'first-party',
        'all',
      ]);
    });

    it('should hide third-party from prompt choices when --exclude-applied-migrations is provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.CI = 'false';
      mockPrompt.mockReturnValueOnce(Promise.resolve({ mode: 'all' }));
      await resolveMode(undefined, 'nx', '22.0.0', {
        hasFrom: false,
        hasExcludeAppliedMigrations: true,
      });
      const choices = mockPrompt.mock.calls[0][0].choices;
      expect(choices.map((c: { name: string }) => c.name)).toEqual([
        'first-party',
        'all',
      ]);
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
      mockGetInstalledNxPackageGroup.mockReturnValue(
        new Set(['nx', '@nx/js', '@nx/workspace'])
      );
      mockGetInstalledLegacyNrwlWorkspaceVersion.mockReturnValue(null);
      delete process.env.CI;
      delete process.env.NX_MULTI_MAJOR_MODE;
    });

    afterEach(() => {
      mockGetInstalledNxVersion.mockReset();
      mockGetInstalledNxPackageGroup.mockReset();
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'next',
        mode: 'all',
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

      await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
      });

      const promptArgs = mockPrompt.mock.calls[0][0];
      const choices = promptArgs.choices as { name: string }[];
      expect(choices.map((c) => c.name)).toEqual(['22.5.3', '23.1.0']);
    });

    it('should prompt (not warn) when target was explicitly typed as numeric semver', async () => {
      setTty(true);
      mockRegistry({
        '21': '21.5.3',
        '22': '22.5.3',
      });
      mockPrompt.mockResolvedValue({ chosen: '21.5.3' });
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@23.1.0',
        mode: 'all',
      });

      expect(mockPrompt).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '21.5.3' });
    });

    it('should warn (not prompt) in non-TTY environments', async () => {
      setTty(false);
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should not prompt or warn when --multi-major-mode=direct is set', async () => {
      setTty(true);
      mockRegistry({ latest: '23.1.0' });
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
        multiMajorMode: 'direct',
      });

      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should bypass --multi-major-mode=gradual when --mode=third-party', async () => {
      setTty(true);
      // third-party anchors at the installed canonical (here 21.0.0) and
      // must not be redirected to an incremental target. `maybePromptOrWarn…`
      // early-returns on `mode === 'third-party'` before consulting gradual,
      // so the flag is accepted but is a no-op.
      mockRegistry({
        latest: '23.1.0',
        '21': '21.5.3',
        '22': '22.5.3',
      });
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({
        packageAndVersion: 'nx@21.0.0',
        mode: 'third-party',
        multiMajorMode: 'gradual',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '21.0.0' });
    });

    it('should not prompt or warn when delta is exactly 1 major', async () => {
      setTty(true);
      mockRegistry({ latest: '22.5.3' });
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ targetVersion: '23.1.0' });
    });

    it('should not prompt or warn for --mode=third-party', async () => {
      setTty(true);
      const warnSpy = spyWarn();

      const r = await parseMigrationsOptions({ mode: 'third-party' });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(r).toMatchObject({ mode: 'third-party' });
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

        const r = await parseMigrationsOptions({
          packageAndVersion: positional,
          mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const bare = await parseMigrationsOptions({ mode: 'all' });
      expect(bare).toMatchObject({ targetVersion: '22.5.3' });
      expect(
        (bare as { originalTargetVersion?: string }).originalTargetVersion
      ).toBeUndefined();

      const barePkg = await parseMigrationsOptions({
        packageAndVersion: 'nx',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
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

      const r = await parseMigrationsOptions({
        packageAndVersion: 'latest',
        mode: 'all',
      });

      expect(r).toMatchObject({
        targetVersion: '22.5.3',
        originalTargetVersion: '23.1.0',
      });
      expect((r as { multiMajorMode?: string }).multiMajorMode).toBeUndefined();
    });
  });
});

import * as enquirer from 'enquirer';
import { PackageJson } from '../../utils/package-json';
import * as packageMgrUtils from '../../utils/package-manager';

import {
  Migrator,
  normalizeVersion,
  parseMigrationsOptions,
  ResolvedMigrationConfiguration,
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

      await expect(
        migrator.migrate('mypackage', 'myversion')
      ).rejects.toThrowError(/cannot fetch/);
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
        jest
          .spyOn(enquirer, 'prompt')
          .mockReturnValue(Promise.resolve({ shouldApply: true }));
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
        expect(enquirer.prompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ message: promptMessage }),
          ])
        );
      });

      it('should filter out updates when prompt answer is false', async () => {
        jest
          .spyOn(enquirer, 'prompt')
          .mockReturnValue(Promise.resolve({ shouldApply: false }));
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
        expect(enquirer.prompt).toHaveBeenCalled();
      });

      it('should not prompt and get all updates when --interactive=false', async () => {
        jest
          .spyOn(enquirer, 'prompt')
          .mockReturnValue(Promise.resolve({ shouldApply: false }));
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
        expect(enquirer.prompt).not.toHaveBeenCalled();
      });
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
        jest
          .spyOn(enquirer, 'prompt')
          .mockReturnValue(Promise.resolve({ shouldApply: true }));
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
        expect(enquirer.prompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ message: promptMessage }),
          ])
        );
      });

      it('should not prompt when requirements are not met', async () => {
        jest
          .spyOn(enquirer, 'prompt')
          .mockReturnValue(Promise.resolve({ shouldApply: true }));
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
        expect(enquirer.prompt).not.toHaveBeenCalled();
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
      jest
        .spyOn(enquirer, 'prompt')
        .mockReturnValue(Promise.resolve({ shouldApply: false }));
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
      expect(enquirer.prompt).toHaveBeenCalled();
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

  describe('parseMigrationsOptions', () => {
    it('should work for generating migrations', async () => {
      const r = await parseMigrationsOptions({
        packageAndVersion: '8.12.0',
        from: '@myscope/a@12.3,@myscope/b@1.1.1',
        to: '@myscope/c@12.3.1',
      });
      expect(r).toEqual({
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

    it('should handle different variations of the target package', async () => {
      jest
        .spyOn(packageMgrUtils, 'packageRegistryView')
        .mockImplementation((pkg, version) => {
          return Promise.resolve(version);
        });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '@angular/core' })
      ).toMatchObject({
        targetPackage: '@angular/core',
        targetVersion: 'latest',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8.12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.0.0',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '12.0.0',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '8.12.0-beta.0' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0-beta.0',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: 'next' })
      ).toMatchObject({
        targetPackage: 'nx',
        targetVersion: 'next',
      });
      expect(
        await parseMigrationsOptions({ packageAndVersion: '13.10.0' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '13.10.0',
      });
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
      ).rejects.toThrowError(
        `Incorrect 'from' section. Use --from="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          from: '@myscope/a',
        })
      ).rejects.toThrowError(
        `Incorrect 'from' section. Use --from="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', from: 'myscope' })
      ).rejects.toThrowError(
        `Incorrect 'from' section. Use --from="package@version"`
      );
    });

    it('should handle incorrect to', async () => {
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a@',
        })
      ).rejects.toThrowError(
        `Incorrect 'to' section. Use --to="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a',
        })
      ).rejects.toThrowError(
        `Incorrect 'to' section. Use --to="package@version"`
      );
      await expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', to: 'myscope' })
      ).rejects.toThrowError(
        `Incorrect 'to' section. Use --to="package@version"`
      );
    });

    it('should handle backslashes in package names', async () => {
      const r = await parseMigrationsOptions({
        packageAndVersion: '@nx\\workspace@8.12.0',
        from: '@myscope\\a@12.3,@myscope\\b@1.1.1',
        to: '@myscope\\c@12.3.1',
      });
      expect(r).toEqual({
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
  });
});

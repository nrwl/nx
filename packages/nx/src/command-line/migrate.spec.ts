import { PackageJson } from '../utils/package-json';
import { Migrator, normalizeVersion, parseMigrationsOptions } from './migrate';

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
        versions: () => '1.0',
        fetch: (_p, _v) => {
          throw new Error('cannot fetch');
        },
        to: {},
      });

      await expect(
        migrator.updatePackageJson('mypackage', 'myversion')
      ).rejects.toThrowError(/cannot fetch/);
    });

    it('should return a patch to the new version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        versions: () => '1.0.0',
        fetch: (_p, _v) => Promise.resolve({ version: '2.0.0' }),
        to: {},
      });

      expect(await migrator.updatePackageJson('mypackage', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
          mypackage: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should collect the information recursively from upserts', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        versions: () => '1.0.0',
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
          newChild: { version: '2.0.0', addToPackageJson: 'devDependencies' },
        },
      });
    });

    it('should support the deprecated "alwaysAddToPackageJson" option', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child1: '1.0.0' } }),
        versions: () => '1.0.0',
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
        to: {},
      });

      expect(await migrator.updatePackageJson('mypackage', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
          mypackage: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '3.0.0', addToPackageJson: false },
          child2: { version: '3.0.0', addToPackageJson: 'dependencies' },
        },
      });
    });

    it('should stop recursive calls when exact version', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        versions: () => '1.0.0',
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
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
        versions: () => '1.0.0',
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child1: { version: '2.0.0', addToPackageJson: false },
          child2: { version: '2.0.0', addToPackageJson: false },
          grandchild: { version: '4.0.0', addToPackageJson: false },
        },
      });
    });

    it('should skip the versions <= currently installed', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { child: '1.0.0', grandchild: '2.0.0' },
        }),
        versions: () => '1.0.0',
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
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
        versions: (p) => (p !== 'not-installed' ? '1.0.0' : null),
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
        migrations: [],
        packageJson: {
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
        versions: () => '1.0.0',
        fetch: async (pkg, version) => {
          if (pkg === '@my-company/nx-workspace') {
            return {
              version: '2.0.0',
              packageGroup: [
                '@my-company/lib-1',
                '@my-company/lib-2',
                '@my-company/lib-3',
                { package: '@my-company/lib-4', version: 'latest' },
              ],
            };
          }
          if (pkg === '@my-company/lib-6') {
            return {
              version: '2.0.0',
              packageGroup: ['@my-company/nx-workspace'],
            };
          }
          if (pkg === '@my-company/lib-3') {
            return {
              version: '2.0.0',
              packageGroup: ['@my-company/lib-3-child'],
            };
          }
          if (version === 'latest') {
            return { version: '2.0.1' };
          }
          return { version: '2.0.0' };
        },
        to: {},
      });

      expect(
        await migrator.updatePackageJson('@my-company/nx-workspace', '2.0.0')
      ).toStrictEqual({
        migrations: [],
        packageJson: {
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
        versions: () => '1.0.0',
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
              packageGroup: ['@my-company/lib-1', '@my-company/lib-2'],
            };
          }
          if (pkg === '@my-company/lib-1' && version === 'latest') {
            return {
              version: '3.0.0',
              packageGroup: ['@my-company/nx-workspace'],
            };
          }
          if (pkg === '@my-company/lib-1' && version === '3.0.0') {
            return {
              version: '3.0.0',
              packageGroup: ['@my-company/nx-workspace'],
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
        to: {},
      });

      expect(
        await migrator.updatePackageJson('@my-company/nx-workspace', '2.0.0')
      ).toStrictEqual({
        migrations: [],
        packageJson: {
          '@my-company/nx-workspace': {
            version: '3.0.0',
            addToPackageJson: false,
          },
          '@my-company/lib-1': { version: '3.0.0', addToPackageJson: false },
          '@my-company/lib-2': { version: '3.0.0', addToPackageJson: false },
        },
      });
    });

    it('should not throw when packages are missing', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        versions: (p) => (p === '@nrwl/nest' ? null : '1.0.0'),
        fetch: (_p, _v) =>
          Promise.resolve({
            version: '2.0.0',
            packageJsonUpdates: { one: { version: '2.0.0', packages: {} } },
          }),
        to: {},
      });
      await migrator.updatePackageJson('@nrwl/workspace', '2.0.0');
    });

    it('should only fetch packages that are installed', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson(),
        versions: (p) => (p === '@nrwl/nest' ? null : '1.0.0'),
        fetch: (p, _v) => {
          if (p === '@nrwl/nest') {
            throw new Error('Boom');
          }
          return Promise.resolve({
            version: '2.0.0',
            packageJsonUpdates: { one: { version: '2.0.0', packages: {} } },
          });
        },
        to: {},
      });
      await migrator.updatePackageJson('@nrwl/workspace', '2.0.0');
    });

    it('should only fetch packages that are top-level deps', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          devDependencies: { parent: '1.0.0', child1: '1.0.0' },
        }),
        versions: () => '1.0.0',
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
        to: {},
      });

      await migrator.updatePackageJson('parent', '2.0.0');
    });
  });

  describe('migrations', () => {
    it('should create a list of migrations to run', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({
          dependencies: { child: '1.0.0', newChild: '1.0.0' },
        }),
        versions: (p) => {
          if (p === 'parent') return '1.0.0';
          if (p === 'child') return '1.0.0';
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
        to: {},
      });
      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
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
        packageJson: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
          newChild: { version: '3.0.0', addToPackageJson: false },
        },
      });
    });

    it('should not generate migrations for non top-level packages', async () => {
      const migrator = new Migrator({
        packageJson: createPackageJson({ dependencies: { child: '1.0.0' } }),
        versions: (p) => {
          if (p === 'parent') return '1.0.0';
          if (p === 'child') return '1.0.0';
          if (p === 'newChild') return '1.0.0'; // installed as a transitive dep, not a top-level dep
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
        to: {},
      });

      expect(await migrator.updatePackageJson('parent', '2.0.0')).toEqual({
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
        packageJson: {
          parent: { version: '2.0.0', addToPackageJson: false },
          child: { version: '2.0.0', addToPackageJson: false },
        },
      });
    });
  });

  describe('normalizeVersions', () => {
    it('should return version when it meets semver requirements', () => {
      expect(normalizeVersion('1.2.3')).toEqual('1.2.3');
      expect(normalizeVersion('1.2.3-beta.1')).toEqual('1.2.3-beta.1');
    });

    it('should handle versions missing a patch or a minor', () => {
      expect(normalizeVersion('1.2')).toEqual('1.2.0');
      expect(normalizeVersion('1')).toEqual('1.0.0');
      expect(normalizeVersion('1-beta.1')).toEqual('1.0.0-beta.1');
    });

    it('should handle incorrect versions', () => {
      expect(normalizeVersion('1-invalid-version')).toEqual('1.0.0-invalid');
      expect(normalizeVersion('1.invalid-version')).toEqual('1.0.0');
      expect(normalizeVersion('invalid-version')).toEqual('0.0.0');
    });
  });

  describe('parseMigrationsOptions', () => {
    it('should work', () => {
      const r = parseMigrationsOptions({
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

    it('should handle different variations of the target package', () => {
      expect(
        parseMigrationsOptions({ packageAndVersion: '@angular/core' })
      ).toMatchObject({
        targetPackage: '@angular/core',
        targetVersion: 'latest',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: '8.12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
      });
      expect(parseMigrationsOptions({ packageAndVersion: '8' })).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.0.0',
      });
      expect(parseMigrationsOptions({ packageAndVersion: '12' })).toMatchObject(
        {
          targetPackage: '@nrwl/workspace',
          targetVersion: '12.0.0',
        }
      );
      expect(
        parseMigrationsOptions({ packageAndVersion: 'next' })
      ).toMatchObject({
        targetPackage: 'nx',
        targetVersion: 'next',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: '13.10.0' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '13.10.0',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: '@nrwl/workspace@8.12' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: 'mypackage@8.12' })
      ).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: '8.12.0',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: 'mypackage' })
      ).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: 'latest',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: 'mypackage2' })
      ).toMatchObject({
        targetPackage: 'mypackage2',
        targetVersion: 'latest',
      });
      expect(
        parseMigrationsOptions({ packageAndVersion: '@nrwl/workspace@latest' })
      ).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: 'latest',
      });
    });

    it('should handle incorrect from', () => {
      expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          from: '@myscope/a@',
        })
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
      expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          from: '@myscope/a',
        })
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
      expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', from: 'myscope' })
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
    });

    it('should handle incorrect to', () => {
      expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a@',
        })
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
      expect(() =>
        parseMigrationsOptions({
          packageAndVersion: '8.12.0',
          to: '@myscope/a',
        })
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
      expect(() =>
        parseMigrationsOptions({ packageAndVersion: '8.12.0', to: 'myscope' })
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
    });

    it('should handle backslashes in package names', () => {
      const r = parseMigrationsOptions({
        packageAndVersion: '@nrwl\\workspace@8.12.0',
        from: '@myscope\\a@12.3,@myscope\\b@1.1.1',
        to: '@myscope\\c@12.3.1',
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
  });
});

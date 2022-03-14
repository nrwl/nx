import { Migrator, normalizeVersion, parseMigrationsOptions } from './migrate';

describe('Migration', () => {
  describe('packageJson patch', () => {
    it('should throw an error when the target package is not available', async () => {
      const migrator = new Migrator({
        packageJson: {},
        versions: () => '1.0',
        fetch: (_p, _v) => {
          throw new Error('cannot fetch');
        },
        from: {},
        to: {},
      });

      try {
        await migrator.updatePackageJson('mypackage', 'myversion');
        throw new Error('fail');
      } catch (e) {
        expect(e.message).toEqual(`cannot fetch`);
      }
    });

    it('should return a patch to the new version', async () => {
      const migrator = new Migrator({
        packageJson: {},
        versions: () => '1.0.0',
        fetch: (_p, _v) => Promise.resolve({ version: '2.0.0' }),
        from: {},
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
        packageJson: { dependencies: { child: '1.0.0' } },
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
        from: {},
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
        packageJson: { dependencies: { child1: '1.0.0' } },
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
        from: {},
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
        packageJson: { dependencies: { child: '1.0.0' } },
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
        from: {},
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
        packageJson: {
          dependencies: {
            child1: '1.0.0',
            child2: '1.0.0',
            grandchild: '1.0.0',
          },
        },
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
        from: {},
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
        packageJson: { dependencies: { child: '1.0.0', grandchild: '2.0.0' } },
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
        from: {},
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
        packageJson: { dependencies: { child1: '1.0.0', child2: '1.0.0' } },
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
        from: {},
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

    // this is temporary. if nx gets used by other projects,
    // we will extract the special casing
    it('should special case @nrwl/workspace', async () => {
      const migrator = new Migrator({
        packageJson: {
          devDependencies: {
            '@nrwl/workspace': '0.9.0',
            '@nrwl/cli': '0.9.0',
            '@nrwl/angular': '0.9.0',
            '@nrwl/cypress': '0.9.0',
            '@nrwl/devkit': '0.9.0',
            '@nrwl/eslint-plugin-nx': '0.9.0',
            '@nrwl/express': '0.9.0',
            '@nrwl/jest': '0.9.0',
            '@nrwl/js': '0.9.0',
            '@nrwl/linter': '0.9.0',
            '@nrwl/nest': '0.9.0',
            '@nrwl/next': '0.9.0',
            '@nrwl/node': '0.9.0',
            '@nrwl/nx-cloud': '0.9.0',
            '@nrwl/nx-plugin': '0.9.0',
            '@nrwl/react': '0.9.0',
            '@nrwl/storybook': '0.9.0',
            '@nrwl/web': '0.9.0',
          },
        },
        versions: () => '1.0.0',
        fetch: (_p, _v) => Promise.resolve({ version: '2.0.0' }),
        from: {},
        to: {},
      });

      expect(
        await migrator.updatePackageJson('@nrwl/workspace', '2.0.0')
      ).toEqual({
        migrations: [],
        packageJson: {
          '@nrwl/workspace': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/cli': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/angular': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/cypress': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/devkit': { addToPackageJson: false, version: '2.0.0' },
          '@nrwl/eslint-plugin-nx': {
            version: '2.0.0',
            addToPackageJson: false,
          },
          '@nrwl/express': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/jest': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/js': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/linter': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/nest': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/next': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/node': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/nx-cloud': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/nx-plugin': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/react': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/storybook': { version: '2.0.0', addToPackageJson: false },
          '@nrwl/web': { version: '2.0.0', addToPackageJson: false },
        },
      });
    });

    it('should not throw when packages are missing', async () => {
      const migrator = new Migrator({
        packageJson: {},
        versions: (p) => (p === '@nrwl/nest' ? null : '1.0.0'),
        fetch: (_p, _v) =>
          Promise.resolve({
            version: '2.0.0',
            packageJsonUpdates: { one: { version: '2.0.0', packages: {} } },
          }),
        from: {},
        to: {},
      });
      await migrator.updatePackageJson('@nrwl/workspace', '2.0.0');
    });

    it('should only fetch packages that are installed', async () => {
      const migrator = new Migrator({
        packageJson: {},
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
        from: {},
        to: {},
      });
      await migrator.updatePackageJson('@nrwl/workspace', '2.0.0');
    });

    it('should only fetch packages that are top-level deps', async () => {
      const migrator = new Migrator({
        packageJson: { devDependencies: { parent: '1.0.0', child1: '1.0.0' } },
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
        from: {},
        to: {},
      });

      await migrator.updatePackageJson('parent', '2.0.0');
    });
  });

  describe('migrations', () => {
    it('should create a list of migrations to run', async () => {
      const migrator = new Migrator({
        packageJson: { dependencies: { child: '1.0.0', newChild: '1.0.0' } },
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
        from: {},
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
        packageJson: { dependencies: { child: '1.0.0' } },
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
        from: {},
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
      const r = parseMigrationsOptions([
        '8.12.0',
        '--from',
        '@myscope/a@12.3,@myscope/b@1.1.1',
        '--to',
        '@myscope/c@12.3.1',
      ]);
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
      expect(parseMigrationsOptions(['@angular/core'])).toMatchObject({
        targetPackage: '@angular/core',
        targetVersion: 'latest',
      });
      expect(parseMigrationsOptions(['8.12'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
      });
      expect(parseMigrationsOptions(['8'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.0.0',
      });
      expect(parseMigrationsOptions(['12'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '12.0.0',
      });
      expect(parseMigrationsOptions(['next'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: 'next',
      });
      expect(parseMigrationsOptions(['@nrwl/workspace@8.12'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: '8.12.0',
      });
      expect(parseMigrationsOptions(['mypackage@8.12'])).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: '8.12.0',
      });
      expect(parseMigrationsOptions(['mypackage'])).toMatchObject({
        targetPackage: 'mypackage',
        targetVersion: 'latest',
      });
      expect(parseMigrationsOptions(['mypackage2'])).toMatchObject({
        targetPackage: 'mypackage2',
        targetVersion: 'latest',
      });
      expect(parseMigrationsOptions(['@nrwl/workspace@latest'])).toMatchObject({
        targetPackage: '@nrwl/workspace',
        targetVersion: 'latest',
      });
    });

    it('should handle incorrect from', () => {
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--from', '@myscope/a@'])
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--from', '@myscope/a'])
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--from', 'myscope'])
      ).toThrowError(`Incorrect 'from' section. Use --from="package@version"`);
    });

    it('should handle incorrect to', () => {
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--to', '@myscope/a@'])
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--to', '@myscope/a'])
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
      expect(() =>
        parseMigrationsOptions(['8.12.0', '--to', 'myscope'])
      ).toThrowError(`Incorrect 'to' section. Use --to="package@version"`);
    });

    it('should handle backslashes in package names', () => {
      const r = parseMigrationsOptions([
        '@nrwl\\workspace@8.12.0',
        '--from',
        '@myscope\\a@12.3,@myscope\\b@1.1.1',
        '--to',
        '@myscope\\c@12.3.1',
      ]);
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

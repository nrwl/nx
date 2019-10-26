import {
  ensureProject,
  forEachCli,
  readFile,
  readJson,
  runCLI,
  updateFile
} from './utils';

forEachCli(() => {
  describe('migrate', () => {
    it('should run migrations', () => {
      ensureProject();

      updateFile(
        `./node_modules/migrate-parent-package/package.json`,
        JSON.stringify({
          version: '1.0.0',
          'nx-migrations': './migrations.json'
        })
      );

      updateFile(
        `./node_modules/migrate-parent-package/migrations.json`,
        JSON.stringify({
          schematics: {
            run11: {
              version: '1.1.0',
              description: '1.1.0',
              factory: './run11'
            },
            run20: {
              version: '2.0.0',
              description: '2.0.0',
              factory: './run20'
            }
          }
        })
      );

      updateFile(
        `./node_modules/migrate-parent-package/run11.js`,
        `
        exports.default = function default_1() {
          return function(host) {
            host.create('file-11', 'content11')
          }
        }
        `
      );

      updateFile(
        `./node_modules/migrate-parent-package/run20.js`,
        `
        exports.default = function default_1() {
          return function(host) {
            host.create('file-20', 'content20')
          }
        }
        `
      );

      updateFile(
        `./node_modules/migrate-child-package/package.json`,
        JSON.stringify({
          version: '1.0.0'
        })
      );

      updateFile(
        './node_modules/@nrwl/tao/src/commands/migrate.js',
        content => {
          const start = content.indexOf('// testing-fetch-start');
          const end = content.indexOf('// testing-fetch-end');

          const before = content.substring(0, start);
          const after = content.substring(end);
          const newFetch = `
             function createFetcher(logger) {
              return function fetch(packageName) {
                if (packageName === 'migrate-parent-package') {
                  return Promise.resolve({
                    version: '2.0.0',
                    schematics: {
                      'run11': {
                        version: '1.1.0'
                      },
                      'run20': {
                        version: '2.0.0'
                      }
                    },
                    packageJsonUpdates: {
                      'run-11': {version: '1.1.0', packages: {'migrate-child-package': {version: '9.0.0', alwaysAddToPackageJson: true}}},
                    }
                  });
                } else {
                  return Promise.resolve({version: '9.0.0'});
                }
              }
            }
            `;

          return `${before}${newFetch}${after}`;
        }
      );

      runCLI(
        'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"'
      );

      // updates package.json
      const packageJson = readJson(`package.json`);
      expect(packageJson.dependencies['migrate-child-package']).toEqual(
        '9.0.0'
      );

      // creates migrations.json
      const migrationsJson = readJson(`migrations.json`);
      expect(migrationsJson).toEqual({
        migrations: [
          {
            package: 'migrate-parent-package',
            version: '1.1.0',
            name: 'run11'
          },
          {
            package: 'migrate-parent-package',
            version: '2.0.0',
            name: 'run20'
          }
        ]
      });

      // runs migrations
      runCLI('migrate --run-migrations=migrations.json');
      expect(readFile('file-11')).toEqual('content11');
      expect(readFile('file-20')).toEqual('content20');
    });
  });
});

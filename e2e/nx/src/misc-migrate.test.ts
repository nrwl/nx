import type { NxJsonConfiguration } from '@nx/devkit';
import {
  getPublishedVersion,
  isNotWindows,
  newProject,
  readFile,
  readJson,
  removeFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

// TODO(colum): Change the fetcher to allow incremental migrations over multiple versions, allowing for beforeAll
describe('migrate', () => {
  beforeEach(() => {
    newProject({ packages: [] });

    updateFile(
      `./node_modules/migrate-parent-package/package.json`,
      JSON.stringify({
        version: '1.0.0',
        name: 'migrate-parent-package',
        'nx-migrations': './migrations.json',
      })
    );

    updateFile(
      `./node_modules/migrate-parent-package/migrations.json`,
      JSON.stringify({
        schematics: {
          run11: {
            version: '1.1.0',
            description: '1.1.0',
            factory: './run11',
          },
        },
        generators: {
          run20: {
            version: '2.0.0',
            description: '2.0.0',
            implementation: './run20',
          },
        },
      })
    );

    updateFile(
      `./node_modules/migrate-parent-package/run11.js`,
      `
        var angular_devkit_core1 = require("@angular-devkit/core");
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
        exports.default = function (host) {
           host.write('file-20', 'content20')
        }
        `
    );

    updateFile(
      `./node_modules/migrate-child-package/package.json`,
      JSON.stringify({
        name: 'migrate-child-package',
        version: '1.0.0',
      })
    );

    updateFile(
      './node_modules/nx/src/command-line/migrate/migrate.js',
      (content) => {
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
                    generators: {
                      'run11': {
                        version: '1.1.0'
                      },
                      'run20': {
                        version: '2.0.0',
                        cli: 'nx'
                      }
                    },
                    packageJsonUpdates: {
                      'run-11': {version: '1.1.0', packages: {
                        'migrate-child-package': {version: '9.0.0', alwaysAddToPackageJson: true},
                        'migrate-child-package-2': {version: '9.0.0', alwaysAddToPackageJson: false},
                        'migrate-child-package-3': {version: '9.0.0', addToPackageJson: false},
                        'migrate-child-package-4': {version: '9.0.0', addToPackageJson: 'dependencies'},
                        'migrate-child-package-5': {version: '9.0.0', addToPackageJson: 'devDependencies'},
                      }},
                    }
                  });
                } else if (packageName === 'nx-token-migration-package') {
                  return Promise.resolve({
                    version: '2.0.0',
                    generators: {
                      'some-migration': {
                        version: '2.0.0'
                      }
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
  });

  it('should run migrations', () => {
    // Ensure package.json has a trailing newline so migration can preserve it
    const packageJsonContent = readFile('package.json');
    if (!packageJsonContent.endsWith('\n')) {
      updateFile('package.json', packageJsonContent + '\n');
    }

    updateJson('nx.json', (j: NxJsonConfiguration) => {
      j.installation = {
        version: getPublishedVersion(),
        plugins: {
          'migrate-child-package': '1.0.0',
        },
      };
      return j;
    });
    runCLI(
      'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"',
      {
        env: {
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      }
    );

    // updates package.json
    const packageJson = readJson(`package.json`);
    expect(packageJson.dependencies['migrate-child-package']).toEqual('9.0.0');
    expect(
      packageJson.dependencies['migrate-child-package-2']
    ).not.toBeDefined();
    expect(
      packageJson.dependencies['migrate-child-package-3']
    ).not.toBeDefined();
    expect(packageJson.dependencies['migrate-child-package-4']).toEqual(
      '9.0.0'
    );
    expect(packageJson.devDependencies['migrate-child-package-5']).toEqual(
      '9.0.0'
    );
    const nxJson: NxJsonConfiguration = readJson(`nx.json`);
    expect(nxJson.installation.plugins['migrate-child-package']).toEqual(
      '9.0.0'
    );
    // should keep new line on package
    const packageContent = readFile('package.json');
    console.log('[DEBUG]: Package contents', packageContent);
    expect(packageContent.charCodeAt(packageContent.length - 1)).toEqual(10);

    // creates migrations.json
    const migrationsJson = readJson(`migrations.json`);
    expect(migrationsJson).toEqual({
      migrations: [
        {
          package: 'migrate-parent-package',
          version: '1.1.0',
          name: 'run11',
        },
        {
          package: 'migrate-parent-package',
          version: '2.0.0',
          name: 'run20',
          cli: 'nx',
        },
      ],
    });

    // runs migrations
    runCLI('migrate --run-migrations=migrations.json', {
      env: {
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
    });
    expect(readFile('file-11')).toEqual('content11');
    expect(readFile('file-20')).toEqual('content20');
  });

  it('should run migrations and create individual git commits when createCommits is enabled', () => {
    runCLI(
      'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"',
      {
        env: {
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      }
    );

    // runs migrations with createCommits enabled
    runCLI('migrate --run-migrations=migrations.json --create-commits', {
      env: {
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
    });

    const recentCommits = runCommand('git --no-pager log --oneline -n 10');

    expect(recentCommits).toContain('chore: [nx migration] run11');
    expect(recentCommits).toContain('chore: [nx migration] run20');
  });

  it('should run migrations and create individual git commits using a provided custom commit prefix', () => {
    // Windows has shell escaping issues so this test would always fail
    if (isNotWindows()) {
      runCLI(
        'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"',
        {
          env: {
            NX_MIGRATE_SKIP_INSTALL: 'true',
            NX_MIGRATE_USE_LOCAL: 'true',
          },
        }
      );

      // runs migrations with createCommits enabled and custom commit-prefix (NOTE: the extra quotes are needed here to avoid shell escaping issues)
      runCLI(
        `migrate --run-migrations=migrations.json --create-commits --commit-prefix="'chore(core): AUTOMATED - '"`,
        {
          env: {
            NX_MIGRATE_SKIP_INSTALL: 'true',
            NX_MIGRATE_USE_LOCAL: 'true',
          },
        }
      );

      const recentCommits = runCommand('git --no-pager log --oneline -n 10');

      expect(recentCommits).toContain('chore(core): AUTOMATED - run11');
      expect(recentCommits).toContain('chore(core): AUTOMATED - run20');
    }
  });

  it('should fail if a custom commit prefix is provided when --create-commits is not enabled', () => {
    runCLI(
      'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"',
      {
        env: {
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      }
    );

    // Invalid: runs migrations with a custom commit-prefix but without enabling --create-commits
    const output = runCLI(
      `migrate --run-migrations=migrations.json --commit-prefix CUSTOM_PREFIX`,
      {
        env: {
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
        silenceError: true,
      }
    );

    expect(output).toContain(
      `Error: Providing a custom commit prefix requires --create-commits to be enabled`
    );
  });

  it('should fail if no migrations are present', () => {
    removeFile(`./migrations.json`);

    // Invalid: runs migrations with a custom commit-prefix but without enabling --create-commits
    const output = runCLI(`migrate --run-migrations`, {
      env: {
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
      silenceError: true,
    });

    expect(output).toContain(
      `File 'migrations.json' doesn't exist, can't run migrations. Use flag --if-exists to run migrations only if the file exists`
    );
  });

  it('should not run migrations if no migrations are present and flag --if-exists is used', () => {
    removeFile(`./migrations.json`);

    // Invalid: runs migrations with a custom commit-prefix but without enabling --create-commits
    const output = runCLI(`migrate --run-migrations --if-exists`, {
      env: {
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
      silenceError: true,
    });

    expect(output).toContain(`Migrations file 'migrations.json' doesn't exist`);
  });

  it('should handle Nx tokens correctly in Angular CLI migration schematics', () => {
    const app1 = uniq('app1');

    updateFile(
      `apps/${app1}/project.json`,
      JSON.stringify(
        {
          name: app1,
          projectType: 'application',
          sourceRoot: `apps/${app1}/src`,
          prefix: 'app',
          targets: {
            build: {
              outputs: ['{options.outputPath}'],
              executor: '@angular/build:application',
              options: {
                outputPath: '{workspaceRoot}/dist/{projectName}',
                browser: '{projectRoot}/src/main.ts',
                polyfills: ['zone.js'],
                tsConfig: '{projectRoot}/tsconfig.app.json',
                assets: [
                  {
                    glob: '**/*',
                    input: '{projectRoot}/public',
                  },
                ],
                styles: [
                  '{projectRoot}/src/styles.css',
                  '{workspaceRoot}/shared/styles.css',
                ],
              },
            },
          },
        },
        null,
        2
      )
    );

    // Create an Angular CLI migration schematic that reads and modifies the angular.json (Nx project.json)
    updateFile(
      `./node_modules/nx-token-migration-package/package.json`,
      JSON.stringify({
        name: 'nx-token-migration-package',
        version: '1.0.0',
        'ng-update': {
          migrations: './migrations.json',
        },
      })
    );
    updateFile(
      `./node_modules/nx-token-migration-package/migrations.json`,
      JSON.stringify({
        schematics: {
          'some-migration': {
            version: '2.0.0',
            factory: './some-migration',
            description: 'A description of the migration',
          },
        },
      })
    );
    // Create a migration schematic that validates Nx tokens are properly resolved
    updateFile(
      `./node_modules/nx-token-migration-package/some-migration.js`,
      `
        const { readWorkspace, writeWorkspace } = require('@schematics/angular/utility');

        exports.default = function migration() {
          return async function (host) {
            const workspace = await readWorkspace(host);
            const project = workspace.projects.get('${app1}');
            const buildTarget = project.targets.get('build');

            // write the build target data to a file to verify it outside of the migration
            host.create('project-data.json', JSON.stringify(buildTarget, null, 2));

            // make some changes to verify to the build target to verify how it's written
            // back to the project.json file
            buildTarget.options.outputPath = 'dist/apps/${app1}';
            buildTarget.options.styles = ['apps/${app1}/src/base_styles.css', 'shared/styles.css'];

            writeWorkspace(host, workspace);
          };
        };
      `
    );

    // Run the migration
    const output = runCLI(
      'migrate nx-token-migration-package@2.0.0 --from="nx-token-migration-package@1.0.0"',
      {
        env: {
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      }
    );
    runCLI('migrate --run-migrations=migrations.json', {
      env: {
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
      verbose: true,
    });

    // Verify that the Angular CLI migration schematic read the build target
    // with the Nx tokens resolved to actual values
    const angularJsonBuildTarget = readJson('project-data.json');
    expect(angularJsonBuildTarget.options).toStrictEqual({
      outputPath: `dist/${app1}`,
      browser: `apps/${app1}/src/main.ts`,
      polyfills: ['zone.js'],
      tsConfig: `apps/${app1}/tsconfig.app.json`,
      assets: [
        {
          glob: '**/*',
          input: `apps/${app1}/public`,
        },
      ],
      styles: [`apps/${app1}/src/styles.css`, 'shared/styles.css'],
    });
    // Verify that the project.json file has been updated with the new values
    // and the Nx tokens have been restored where appropriate
    const projectJson = readJson(`apps/${app1}/project.json`);
    expect(projectJson.targets.build.options).toStrictEqual({
      // this was changed, so only the {workspaceRoot} token is restored
      outputPath: `{workspaceRoot}/dist/apps/${app1}`,
      // these were all unchanged, so the Nx tokens are restored
      browser: '{projectRoot}/src/main.ts',
      polyfills: ['zone.js'],
      tsConfig: '{projectRoot}/tsconfig.app.json',
      assets: [
        {
          glob: '**/*',
          input: '{projectRoot}/public',
        },
      ],
      styles: [
        // this was changed, but it still starts with {projectRoot}, so the
        // {projectRoot} token is restored
        '{projectRoot}/src/base_styles.css',
        // this was unchanged, so the {workspaceRoot} token is restored
        '{workspaceRoot}/shared/styles.css',
      ],
    });
  });
});

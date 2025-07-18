import type { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  createNonNxProjectDirectory,
  e2eCwd,
  getPackageManagerCommand,
  getPublishedVersion,
  isNotWindows,
  killProcessAndPorts,
  newProject,
  readFile,
  readJson,
  removeFile,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { renameSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';
import { major } from 'semver';
import { join } from 'path';

describe('Nx Commands', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/web', '@nx/angular', '@nx/next'],
    })
  );

  afterAll(() => cleanupProject());

  describe('show', () => {
    it('should show the list of projects', async () => {
      const app1 = uniq('myapp');
      const app2 = uniq('myapp');
      expect(
        runCLI('show projects').replace(/.*nx show projects( --verbose)?\n/, '')
      ).toEqual('');

      runCLI(`generate @nx/web:app apps/${app1} --tags e2etag`);
      runCLI(`generate @nx/web:app apps/${app2}`);

      const s = runCLI('show projects').split('\n');

      expect(s.length).toEqual(5);
      expect(s).toContain(app1);
      expect(s).toContain(app2);
      expect(s).toContain(`${app1}-e2e`);
      expect(s).toContain(`${app2}-e2e`);

      const withTag = JSON.parse(runCLI('show projects -p tag:e2etag --json'));
      expect(withTag).toEqual([app1]);

      const withTargets = JSON.parse(
        runCLI('show projects --with-target e2e --json')
      );
      expect(withTargets).toEqual(
        expect.arrayContaining([`${app1}-e2e`, `${app2}-e2e`])
      );
      expect(withTargets.length).toEqual(2);
    });

    it('should show detailed project info', () => {
      const app = uniq('myapp');
      runCLI(
        `generate @nx/web:app apps/${app} --bundler=webpack --unitTestRunner=vitest --linter=eslint`
      );
      const project: ProjectConfiguration = JSON.parse(
        runCLI(`show project ${app} --json`)
      );
      expect(project.targets.build).toBeDefined();
      expect(project.targets.lint).toBeDefined();
    });

    it('should open project details view', async () => {
      const app = uniq('myapp');
      runCLI(`generate @nx/web:app apps/${app}`);
      let url: string;
      let port: number;
      const childProcess = await runCommandUntil(
        `show project ${app} --web --open=false`,
        (output) => {
          console.log(output);
          // output should contain 'Project graph started at http://127.0.0.1:{port}'
          if (output.includes('Project graph started at http://')) {
            const match = /https?:\/\/[\d.]+:(?<port>\d+)/.exec(output);
            if (match) {
              port = parseInt(match.groups.port);
              url = match[0];
              return true;
            }
          }
          return false;
        }
      );
      // Check that url is alive
      const response = await fetch(url);
      expect(response.status).toEqual(200);
      await killProcessAndPorts(childProcess.pid, port);
    }, 700000);

    it('should find alternative port when default port is occupied', async () => {
      const app = uniq('myapp');
      runCLI(`generate @nx/web:app apps/${app}`);

      const http = require('http');

      // Create a server that occupies the default port 4211
      const blockingServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('blocking server');
      });

      await new Promise<void>((resolve) => {
        blockingServer.listen(4211, '127.0.0.1', () => {
          console.log('Blocking server started on port 4211');
          resolve();
        });
      });

      let url: string;
      let port: number;
      let foundAlternativePort = false;

      try {
        const childProcess = await runCommandUntil(
          `show project ${app} --web --open=false`,
          (output) => {
            console.log(output);
            // Should find alternative port and show message about port being in use
            if (output.includes('Port 4211 was already in use, using port')) {
              foundAlternativePort = true;
            }
            // output should contain 'Project graph started at http://127.0.0.1:{port}'
            if (output.includes('Project graph started at http://')) {
              const match = /https?:\/\/[\d.]+:(?<port>\d+)/.exec(output);
              if (match) {
                port = parseInt(match.groups.port);
                url = match[0];
                return true;
              }
            }
            return false;
          }
        );

        // Verify that an alternative port was found
        expect(foundAlternativePort).toBe(true);
        expect(port).not.toBe(4211);
        expect(port).toBeGreaterThan(4211);

        // Check that url is alive
        const response = await fetch(url);
        expect(response.status).toEqual(200);

        await killProcessAndPorts(childProcess.pid, port);
      } finally {
        // Clean up the blocking server
        blockingServer.close();
      }
    }, 700000);
  });

  describe('report and list', () => {
    it(`should report package versions`, async () => {
      const reportOutput = runCLI('report');

      expect(reportOutput).toEqual(
        expect.stringMatching(
          new RegExp(`\@nx\/workspace.*:.*${getPublishedVersion()}`)
        )
      );
      expect(reportOutput).toContain('@nx/workspace');
    }, 120000);

    it(`should list plugins`, async () => {
      let listOutput = runCLI('list');

      expect(listOutput).toContain('NX   Installed plugins');

      // just check for some, not all
      expect(listOutput).toContain('@nx/workspace');

      // temporarily make it look like this isn't installed
      // For pnpm, we need to rename the actual package in .pnpm directory, not just the symlink
      const { readdirSync, statSync } = require('fs');
      const pnpmDir = tmpProjPath('node_modules/.pnpm');
      let renamedPnpmEntry = null;

      if (require('fs').existsSync(pnpmDir)) {
        const entries = readdirSync(pnpmDir);
        const nextEntries = entries.filter((entry) =>
          entry.includes('nx+next@')
        );

        // Rename all nx+next entries
        const renamedEntries = [];
        for (const entry of nextEntries) {
          const tmpName = entry.replace('@nx+next@', 'tmp_nx_next_');
          renameSync(
            tmpProjPath(`node_modules/.pnpm/${entry}`),
            tmpProjPath(`node_modules/.pnpm/${tmpName}`)
          );
          renamedEntries.push(entry);
        }
        renamedPnpmEntry = renamedEntries;
      }

      // Also rename the symlink
      if (require('fs').existsSync(tmpProjPath('node_modules/@nx/next'))) {
        renameSync(
          tmpProjPath('node_modules/@nx/next'),
          tmpProjPath('node_modules/@nx/next_tmp')
        );
      }

      listOutput = runCLI('list');
      expect(listOutput).toContain('NX   Also available');

      // look for specific plugin
      listOutput = runCLI('list @nx/workspace');

      expect(listOutput).toContain('Capabilities in @nx/workspace');

      // check for schematics
      expect(listOutput).toContain('workspace');
      expect(listOutput).toContain('library');

      // check for builders
      expect(listOutput).toContain('run-commands');

      listOutput = runCLI('list @nx/angular');

      expect(listOutput).toContain('Capabilities in @nx/angular');

      expect(listOutput).toContain('library');
      expect(listOutput).toContain('component');

      // check for builders
      expect(listOutput).toContain('package');

      // look for uninstalled core plugin
      listOutput = runCLI('list @nx/next');

      expect(listOutput).toContain('NX   @nx/next is not currently installed');

      // look for an unknown plugin
      listOutput = runCLI('list @wibble/fish');

      expect(listOutput).toContain(
        'NX   @wibble/fish is not currently installed'
      );

      // put back the @nx/next module (or all the other e2e tests after this will fail)
      if (renamedPnpmEntry && Array.isArray(renamedPnpmEntry)) {
        for (const entry of renamedPnpmEntry) {
          const tmpName = entry.replace('@nx+next@', 'tmp_nx_next_');
          renameSync(
            tmpProjPath(`node_modules/.pnpm/${tmpName}`),
            tmpProjPath(`node_modules/.pnpm/${entry}`)
          );
        }
      }

      if (require('fs').existsSync(tmpProjPath('node_modules/@nx/next_tmp'))) {
        renameSync(
          tmpProjPath('node_modules/@nx/next_tmp'),
          tmpProjPath('node_modules/@nx/next')
        );
      }
    }, 120000);
  });

  describe('format', () => {
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    beforeAll(async () => {
      runCLI(`generate @nx/web:app apps/${myapp}`);
      runCLI(`generate @nx/js:lib libs/${mylib}`);
    });

    beforeEach(() => {
      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
       const x = 1111;
  `
      );

      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        `
       const y = 1111;
  `
      );

      updateFile(
        `apps/${myapp}/src/app/app.element.ts`,
        `
       const z = 1111;
  `
      );

      updateFile(
        `libs/${mylib}/index.ts`,
        `
       const x = 1111;
  `
      );
      updateFile(
        `libs/${mylib}/src/${mylib}.spec.ts`,
        `
       const y = 1111;
  `
      );

      updateFile(
        `README.md`,
        `
       my new readme;
  `
      );
    });

    it('should check libs and apps specific files', async () => {
      if (isNotWindows()) {
        const stdout = runCLI(
          `format:check --files="libs/${mylib}/index.ts,package.json" --libs-and-apps`,
          { silenceError: true }
        );
        expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
        expect(stdout).toContain(
          path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
        );
        expect(stdout).not.toContain(path.normalize(`README.md`)); // It will be contained only in case of exception, that we fallback to all
      }
    }, 90000);

    it('should check specific project', async () => {
      if (isNotWindows()) {
        const stdout = runCLI(`format:check --projects=${myapp}`, {
          silenceError: true,
        });
        expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.ts`)
        );
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
        );
        expect(stdout).not.toContain(path.normalize(`libs/${mylib}/index.ts`));
        expect(stdout).not.toContain(
          path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
        );
        expect(stdout).not.toContain(path.normalize(`README.md`));
      }
    }, 90000);

    it('should check multiple projects', async () => {
      if (isNotWindows()) {
        const stdout = runCLI(`format:check --projects=${myapp},${mylib}`, {
          silenceError: true,
        });
        expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
        );
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.ts`)
        );
        expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
        expect(stdout).toContain(
          path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
        );
        expect(stdout).not.toContain(path.normalize(`README.md`));
      }
    }, 90000);

    it('should check all', async () => {
      if (isNotWindows()) {
        const stdout = runCLI(`format:check --all`, { silenceError: true });
        expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
        );
        expect(stdout).toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.ts`)
        );
        expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
        expect(stdout).toContain(
          path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
        );
        expect(stdout).toContain(path.normalize(`README.md`));
      }
    }, 90000);

    it('should throw error if passing both projects and --all param', async () => {
      if (isNotWindows()) {
        const { stderr } = await runCLIAsync(
          `format:check --projects=${myapp},${mylib} --all`,
          {
            silenceError: true,
          }
        );
        expect(stderr).toContain(
          'Arguments all and projects are mutually exclusive'
        );
      }
    }, 90000);

    it('should reformat the code', async () => {
      if (isNotWindows()) {
        runCLI(
          `format:write --files="apps/${myapp}/src/app/app.element.spec.ts,apps/${myapp}/src/app/app.element.ts"`
        );
        const stdout = runCLI('format:check --all', { silenceError: true });
        expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
        expect(stdout).not.toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
        );
        expect(stdout).not.toContain(
          path.normalize(`apps/${myapp}/src/app/app.element.ts`)
        );

        runCLI('format:write --all');
        expect(runCLI('format:check --all')).not.toContain(
          path.normalize(`apps/${myapp}/src/main.ts`)
        );
      }
    }, 300000);
  });

  it('should show help if no command provided', () => {
    const output = runCLI('', { silenceError: true });
    expect(output).toContain('Smart Repos · Fast Builds');
    expect(output).toContain('Commands:');
  });
});

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

describe('global installation', () => {
  // Additionally, installing Nx under e2eCwd like this still acts like a global install,
  // but is easier to cleanup and doesn't mess with the users PC if running tests locally.
  const globalsPath = path.join(e2eCwd, 'globals', 'node_modules', '.bin');

  let oldPath: string;

  beforeAll(() => {
    ensureDirSync(globalsPath);
    writeFileSync(
      path.join(path.dirname(path.dirname(globalsPath)), 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            nx: getPublishedVersion(),
          },
        },
        null,
        2
      )
    );

    runCommand(getPackageManagerCommand().install, {
      cwd: path.join(e2eCwd, 'globals'),
    });

    // Update process.path to have access to modules installed in e2ecwd/node_modules/.bin,
    // this lets commands run things like `nx`. We put it at the beginning so they are found first.
    oldPath = process.env.PATH;
    process.env.PATH = globalsPath + path.delimiter + process.env.PATH;
  });

  afterAll(() => {
    process.env.PATH = oldPath;
  });

  describe('inside nx directory', () => {
    beforeAll(() => {
      newProject({ packages: [] });
    });

    it('should invoke Nx commands from local repo', () => {
      const nxJsContents = readFile('node_modules/nx/bin/nx.js');
      updateFile('node_modules/nx/bin/nx.js', `console.log('local install');`);
      let output: string;
      expect(() => {
        output = runCommand(`nx show projects`);
      }).not.toThrow();
      expect(output).toContain('local install');
      updateFile('node_modules/nx/bin/nx.js', nxJsContents);
    });

    it('should warn if local Nx has higher major version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = `${major(getPublishedVersion()) + 2}.0.0`;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx show projects`);
      }).not.toThrow();
      expect(output).toContain(`It's time to update Nx`);
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });

    it('--version should display global installs version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      const localVersion = `${major(getPublishedVersion()) + 2}.0.0`;
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = localVersion;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx --version`);
      }).not.toThrow();
      expect(output).toContain(`- Local: v${localVersion}`);
      expect(output).toContain(`- Global: v${getPublishedVersion()}`);
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });

    it('report should display global installs version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      const localVersion = `${major(getPublishedVersion()) + 2}.0.0`;
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = localVersion;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx report`);
      }).not.toThrow();
      expect(output).toEqual(
        expect.stringMatching(new RegExp(`nx.*:.*${localVersion}`))
      );
      expect(output).toEqual(
        expect.stringMatching(
          new RegExp(`nx \\(global\\).*:.*${getPublishedVersion()}`)
        )
      );
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });
  });

  describe('non-nx directory', () => {
    beforeAll(() => {
      createNonNxProjectDirectory();
    });

    it('--version should report global version and local not found', () => {
      let output: string;
      expect(() => {
        output = runCommand(`nx --version`);
      }).not.toThrow();
      expect(output).toContain(`- Local: Not found`);
      expect(output).toContain(`- Global: v${getPublishedVersion()}`);
    });

    it('graph should work in npm workspaces repo', () => {
      expect(() => {
        runCommand(`nx graph --file graph.json`);
      }).not.toThrow();
      const { graph } = readJson('graph.json');
      expect(graph).toHaveProperty('nodes');
    });
  });
});

describe('cross-workspace implicit dependencies', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/js'],
    })
  );

  afterAll(() => cleanupProject());

  it('should successfully build a project graph when cross-workspace implicit dependencies are present', () => {
    const npmPackage = uniq('npm-package');
    runCLI(`generate @nx/workspace:npm-package ${npmPackage}`);

    function setImplicitDependencies(deps: string[]) {
      updateFile(join(npmPackage, 'package.json'), (content) => {
        const json = JSON.parse(content);
        json.nx = {
          ...json.nx,
          implicitDependencies: deps,
        };
        return JSON.stringify(json, null, 2);
      });
    }

    // First set the implicit dependencies to an intentionally invalid value to prove the command fails during project graph construction
    setImplicitDependencies(['this-project-does-not-exist']);
    expect(
      runCLI(`test ${npmPackage}`, {
        silenceError: true,
      })
    ).toContain('Failed to process project graph');

    // Now set the implicit dependencies to a cross-workspace reference to prove that it is valid, despite not being resolvable in the current workspace
    setImplicitDependencies(['nx-cloud:another-workspace']);
    expect(
      runCLI(`test ${npmPackage}`, {
        silenceError: true,
      })
    ).toContain('Successfully ran target test');
  });
});

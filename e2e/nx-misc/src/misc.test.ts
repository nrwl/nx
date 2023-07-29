import type { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  createNonNxProjectDirectory,
  e2eCwd,
  getPackageManagerCommand,
  getPublishedVersion,
  isNotWindows,
  newProject,
  readFile,
  readJson,
  removeFile,
  runCLI,
  runCLIAsync,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { renameSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';
import { major } from 'semver';

describe('Nx Commands', () => {
  let proj: string;
  beforeAll(() => (proj = newProject()));

  afterAll(() => cleanupProject());

  describe('show', () => {
    it('should show the list of projects', () => {
      const app1 = uniq('myapp');
      const app2 = uniq('myapp');
      expect(
        runCLI('show projects').replace(/.*nx show projects( --verbose)?\n/, '')
      ).toEqual('');

      runCLI(`generate @nx/web:app ${app1} --tags e2etag`);
      runCLI(`generate @nx/web:app ${app2}`);

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
      runCLI(`generate @nx/web:app ${app}`);
      const project: ProjectConfiguration = JSON.parse(
        runCLI(`show project ${app}`)
      );
      expect(project.targets.build).toBeDefined();
      expect(project.targets.lint).toBeDefined();
    });
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
      renameSync(
        tmpProjPath('node_modules/@nx/next'),
        tmpProjPath('node_modules/@nx/next_tmp')
      );

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

      // // look for uninstalled core plugin
      listOutput = runCLI('list @nx/next');

      expect(listOutput).toContain('NX   @nx/next is not currently installed');

      // look for an unknown plugin
      listOutput = runCLI('list @wibble/fish');

      expect(listOutput).toContain(
        'NX   @wibble/fish is not currently installed'
      );

      // put back the @nx/angular module (or all the other e2e tests after this will fail)
      renameSync(
        tmpProjPath('node_modules/@nx/next_tmp'),
        tmpProjPath('node_modules/@nx/next')
      );
    }, 120000);
  });

  describe('format', () => {
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    beforeAll(() => {
      runCLI(`generate @nx/web:app ${myapp}`);
      runCLI(`generate @nx/js:lib ${mylib}`);
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
});

// TODO(colum): Change the fetcher to allow incremental migrations over multiple versions, allowing for beforeAll
describe('migrate', () => {
  beforeEach(() => {
    newProject();

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
          ...process.env,
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
        ...process.env,
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
          ...process.env,
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      }
    );

    // runs migrations with createCommits enabled
    runCLI('migrate --run-migrations=migrations.json --create-commits', {
      env: {
        ...process.env,
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
            ...process.env,
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
            ...process.env,
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
          ...process.env,
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
          ...process.env,
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
        ...process.env,
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
        ...process.env,
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
      silenceError: true,
    });

    expect(output).toContain(`Migrations file 'migrations.json' doesn't exist`);
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
      newProject();
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
      expect(output).toContain('Its time to update Nx');
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

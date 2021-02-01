import { packagesWeCareAbout } from '@nrwl/workspace/src/command-line/report';
import { renameSync } from 'fs';
import {
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('Cli', () => {
  it('should execute long running tasks', () => {
    newProject();
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/web:app ${myapp}`);

    updateFile(workspaceConfigName(), (c) => {
      const w = JSON.parse(c);
      w.projects[myapp].targets['counter'] = {
        executor: '@nrwl/workspace:counter',
        options: {
          to: 2,
        },
      };
      return JSON.stringify(w);
    });

    const success = runCLI(`counter ${myapp} --result=true`);
    expect(success).toContain('0');
    expect(success).toContain('1');

    expect(() => runCLI(`counter ${myapp} --result=false`)).toThrowError();
  });

  it('should run npm scripts', async () => {
    newProject();
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/node:lib ${mylib}`);

    updateFile(workspaceConfigName(), (c) => {
      const j = JSON.parse(c);
      delete j.projects[mylib].targets;
      return JSON.stringify(j);
    });

    updateFile(
      `libs/${mylib}/package.json`,
      JSON.stringify({
        name: 'mylib1',
        scripts: { echo: `echo ECHOED` },
      })
    );

    const { stdout } = await runCLIAsync(`echo ${mylib} --a=123`, {
      silent: true,
    });
    expect(stdout).toMatch(/ECHOED "?--a=123"?/);
  }, 1000000);

  it('should show help', async () => {
    newProject();
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/web:app ${myapp}`);

    let mainHelp = runCLI(`--help`);
    expect(mainHelp).toContain('Run a target for a project');
    expect(mainHelp).toContain('Run task for affected projects');

    mainHelp = runCLI(`help`);
    expect(mainHelp).toContain('Run a target for a project');
    expect(mainHelp).toContain('Run task for affected projects');

    const genHelp = runCLI(`g @nrwl/web:app --help`);
    expect(genHelp).toContain(
      'The file extension to be used for style files. (default: css)'
    );

    const buildHelp = runCLI(`build ${myapp} --help`);
    expect(buildHelp).toContain('The name of the main entry-point file.');

    const affectedHelp = runCLI(`affected --help`);
    expect(affectedHelp).toContain('Run task for affected projects');

    const version = runCLI(`--version`);
    expect(version).toContain(process.env.PUBLISHED_VERSION); // stub value
  }, 120000);
});

describe('report', () => {
  it(`should report package versions`, async () => {
    newProject();

    const reportOutput = runCLI('report');

    packagesWeCareAbout.forEach((p) => {
      expect(reportOutput).toContain(p);
    });
  }, 120000);
});

describe('list', () => {
  beforeEach(() => {
    newProject();
  });

  it(`should work`, async () => {
    let listOutput = runCLI('list');

    expect(listOutput).toContain('NX  Installed plugins');

    // just check for some, not all
    expect(listOutput).toContain('@nrwl/angular');

    // temporarily make it look like this isn't installed
    renameSync(
      tmpProjPath('node_modules/@nrwl/angular'),
      tmpProjPath('node_modules/@nrwl/angular_tmp')
    );

    listOutput = runCLI('list');
    expect(listOutput).toContain('NX  Also available');

    // look for specific plugin
    listOutput = runCLI('list @nrwl/workspace');

    expect(listOutput).toContain('Capabilities in @nrwl/workspace');

    // check for schematics
    expect(listOutput).toContain('workspace');
    expect(listOutput).toContain('ng-add');
    expect(listOutput).toContain('library');

    // check for builders
    expect(listOutput).toContain('run-commands');

    // // look for uninstalled core plugin
    listOutput = runCLI('list @nrwl/angular');

    expect(listOutput).toContain(
      'NX   NOTE  @nrwl/angular is not currently installed'
    );

    // look for an unknown plugin
    listOutput = runCLI('list @wibble/fish');

    expect(listOutput).toContain(
      'NX   NOTE  @wibble/fish is not currently installed'
    );

    // put back the @nrwl/angular module (or all the other e2e tests after this will fail)
    renameSync(
      tmpProjPath('node_modules/@nrwl/angular_tmp'),
      tmpProjPath('node_modules/@nrwl/angular')
    );
  }, 120000);
});

describe('migrate', () => {
  it('should run migrations', () => {
    newProject();

    updateFile(
      `./node_modules/migrate-parent-package/package.json`,
      JSON.stringify({
        version: '1.0.0',
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
        version: '1.0.0',
      })
    );

    updateFile(
      './node_modules/@nrwl/tao/src/commands/migrate.js',
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
    expect(readFile(`package.json`).endsWith(`}\n`)).toEqual(true);

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
});

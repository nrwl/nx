import type { NxJsonConfiguration } from '@nx/devkit';
import {
  newWrappedNxWorkspace,
  updateFile,
  updateJson,
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getPublishedVersion,
  uniq,
  readJson,
  readFile,
} from '@nx/e2e/utils';
import { bold } from 'chalk';

describe('nx wrapper / .nx installation', () => {
  let runNxWrapper: ReturnType<typeof newWrappedNxWorkspace>;

  beforeAll(() => {
    runNxWrapper = newWrappedNxWorkspace();
  });

  afterAll(() => {
    cleanupProject({
      skipReset: true,
    });
  });

  it('should support running targets in a repo with .nx', () => {
    updateFile(
      'projects/a/project.json',
      JSON.stringify({
        name: 'a',
        targets: {
          echo: {
            command: `echo 'Hello from A'`,
          },
        },
      })
    );

    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.tasksRunnerOptions.default.options.cacheableOperations = ['echo'];
      json.installation.plugins = {
        '@nx/js': getPublishedVersion(),
      };
      return json;
    });

    expect(runNxWrapper('echo a')).toContain('Hello from A');

    expect(runNxWrapper('echo a')).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );

    assertNoRootPackages();
    expect(() =>
      checkFilesExist(
        '.nx/installation/package.json',
        '.nx/installation/package-lock.json',
        '.nx/cache/terminalOutputs'
      )
    ).not.toThrow();
  });

  it('should work with nx report', () => {
    const output = runNxWrapper('report');
    expect(output).toMatch(new RegExp(`nx.*:.*${getPublishedVersion()}`));
    expect(output).toMatch(new RegExp(`@nx/js.*:.*${getPublishedVersion()}`));
    expect(output).not.toContain('@nx/express');
  });

  it('should work with nx list', () => {
    let output = runNxWrapper('list');
    const lines = output.split('\n');
    const installedPluginStart = lines.findIndex((l) =>
      l.includes('Installed plugins')
    );
    const installedPluginEnd = lines.findIndex((l) =>
      l.includes('Also available')
    );
    const installedPluginLines = lines.slice(
      installedPluginStart + 1,
      installedPluginEnd
    );

    expect(installedPluginLines.some((x) => x.includes(`${bold('nx')}`)));
    expect(installedPluginLines.some((x) => x.includes(`${bold('@nx/js')}`)));

    output = runNxWrapper('list @nx/js');
    expect(output).toContain('Capabilities in @nx/js');
  });

  it('should work with basic generators', () => {
    updateJson<NxJsonConfiguration>('nx.json', (j) => {
      j.installation.plugins ??= {};
      j.installation.plugins['@nx/workspace'] = getPublishedVersion();
      return j;
    });
    expect(() => runNxWrapper(`g npm-package ${uniq('pkg')}`)).not.toThrow();
    expect(() => checkFilesExist());
  });

  it('should work with migrate', () => {
    updateFile(
      `.nx/installation/node_modules/migrate-parent-package/package.json`,
      JSON.stringify({
        version: '1.0.0',
        name: 'migrate-parent-package',
        'nx-migrations': './migrations.json',
      })
    );

    updateFile(
      `.nx/installation/node_modules/migrate-parent-package/migrations.json`,
      JSON.stringify({
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
      `.nx/installation/node_modules/migrate-parent-package/run20.js`,
      `
        exports.default = function (host) {
           host.write('file-20', 'content20')
        }
        `
    );

    updateFile(
      `.nx/installation/node_modules/migrate-child-package/package.json`,
      JSON.stringify({
        name: 'migrate-child-package',
        version: '1.0.0',
      })
    );

    /**
     * Patches migration fetcher to load in migrations that we are using to test.
     */
    updateFile(
      '.nx/installation/node_modules/nx/src/command-line/migrate/migrate.js',
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
                      'run20': {
                        version: '2.0.0',
                        cli: 'nx'
                      }
                    },
                    packageJsonUpdates: {
                      'run-11': {version: '1.1.0', packages: {
                        'migrate-child-package': {version: '9.0.0', alwaysAddToPackageJson: false},
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

    updateJson('nx.json', (j: NxJsonConfiguration) => {
      j.installation = {
        version: getPublishedVersion(),
        plugins: {
          'migrate-child-package': '1.0.0',
        },
      };
      return j;
    });
    runNxWrapper(
      'migrate migrate-parent-package@2.0.0 --from="migrate-parent-package@1.0.0"',
      {
        env: {
          ...process.env,
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
          NX_WRAPPER_SKIP_INSTALL: 'true',
        },
      }
    );

    const nxJson: NxJsonConfiguration = readJson(`nx.json`);
    expect(nxJson.installation.plugins['migrate-child-package']).toEqual(
      '9.0.0'
    );
    // creates migrations.json
    const migrationsJson = readJson(`migrations.json`);
    expect(migrationsJson).toEqual({
      migrations: [
        {
          package: 'migrate-parent-package',
          version: '2.0.0',
          name: 'run20',
          cli: 'nx',
        },
      ],
    });

    // runs migrations
    runNxWrapper('migrate --run-migrations=migrations.json', {
      env: {
        ...process.env,
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
        NX_WRAPPER_SKIP_INSTALL: 'true',
      },
    });
    expect(readFile('file-20')).toEqual('content20');
  });
});

function assertNoRootPackages() {
  expect(() =>
    checkFilesDoNotExist(
      'node_modules',
      'package.json',
      'package-lock.json',
      'yarn-lock.json',
      'pnpm-lock.yaml'
    )
  ).not.toThrow();
}

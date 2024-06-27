import {
  checkFilesExist,
  cleanupProject,
  fileExists,
  isWindows,
  newProject,
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
import { PackageJson } from 'nx/src/utils/package-json';
import * as path from 'path';

describe('Nx Running Tests', () => {
  let proj: string;
  beforeAll(
    () => (proj = newProject({ packages: ['@nx/js', '@nx/web', '@nx/node'] }))
  );
  afterAll(() => cleanupProject());

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateFile('nx.json', JSON.stringify(existingNxJson, null, 2));
  });

  describe('running targets', () => {
    describe('(forwarding params)', () => {
      let proj = uniq('proj');
      beforeAll(() => {
        runCLI(`generate @nx/js:lib ${proj}`);
        updateJson(`libs/${proj}/project.json`, (c) => {
          c.targets['echo'] = {
            command: 'echo ECHO:',
          };
          return c;
        });
      });

      it.each([
        '--watch false',
        '--watch=false',
        '--arr=a,b,c',
        '--arr=a --arr=b --arr=c',
        'a',
        '--a.b=1',
        '--a.b 1',
        '-- a b c --a --a.b=1',
        '--ignored -- a b c --a --a.b=1',
      ])('should forward %s properly', (args) => {
        const output = runCLI(`echo ${proj} ${args}`);
        expect(output).toContain(`ECHO: ${args.replace(/^.*-- /, '')}`);
      });

      it.each([
        {
          args: '--test="hello world" "abc def"',
          result: '--test="hello world" "abc def"',
        },
        {
          args: `--test="hello world" 'abc def'`,
          result: '--test="hello world" "abc def"',
        },
        {
          args: `--test="hello world" 'abcdef'`,
          result: '--test="hello world" abcdef',
        },
        {
          args: `--test='hello world' 'abcdef'`,
          result: '--test="hello world" abcdef',
        },
        {
          args: `"--test='hello world' 'abcdef'"`,
          result: `--test='hello world' 'abcdef'`,
        },
      ])('should forward %args properly with quotes', ({ args, result }) => {
        const output = runCLI(`echo ${proj} ${args}`);
        expect(output).toContain(`ECHO: ${result}`);
      });

      it.each([
        {
          args: '-- a b c --a --a.b=1 --no-color --no-parallel',
          result: 'ECHO: a b c --a --a.b=1',
        },
        {
          args: '-- a b c --a --a.b=1 --color --parallel',
          result: 'ECHO: a b c --a --a.b=1',
        },
      ])(
        'should not forward --color --parallel for $args',
        ({ args, result }) => {
          const output = runCLI(`echo ${proj} ${args}`);
          expect(output).toContain(result);
        }
      );
    });

    it('should execute long running tasks', () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nx/web:app ${myapp}`);
      updateJson(`apps/${myapp}/project.json`, (c) => {
        c.targets['counter'] = {
          executor: '@nx/workspace:counter',
          options: {
            to: 2,
          },
        };
        return c;
      });

      const success = runCLI(`counter ${myapp} --result=true`);
      expect(success).toContain('0');
      expect(success).toContain('1');

      expect(() => runCLI(`counter ${myapp} --result=false`)).toThrowError();
    });

    it('should run npm scripts', async () => {
      const mylib = uniq('mylib');
      runCLI(`generate @nx/node:lib ${mylib}`);

      // Used to restore targets to lib after test
      const original = readJson(`libs/${mylib}/project.json`);
      updateJson(`libs/${mylib}/project.json`, (j) => {
        delete j.targets;
        return j;
      });

      updateFile(
        `libs/${mylib}/package.json`,
        JSON.stringify(<PackageJson>{
          name: 'mylib1',
          version: '1.0.0',
          scripts: { 'echo:dev': `echo ECHOED`, 'echo:fail': 'should not run' },
          nx: {
            includedScripts: ['echo:dev'],
          },
        })
      );

      const { stdout } = await runCLIAsync(
        `echo:dev ${mylib} -- positional --a=123 --no-b`,
        {
          silent: true,
        }
      );
      if (isWindows()) {
        expect(stdout).toMatch(/ECHOED "positional" "--a=123" "--no-b"/);
      } else {
        expect(stdout).toMatch(/ECHOED positional --a=123 --no-b/);
      }

      expect(runCLI(`echo:fail ${mylib}`, { silenceError: true })).toContain(
        `Cannot find configuration for task ${mylib}:echo:fail`
      );

      updateJson(`libs/${mylib}/project.json`, (c) => original);
    }, 1000000);

    describe('tokens support', () => {
      let app: string;

      beforeAll(async () => {
        app = uniq('myapp');
        runCLI(`generate @nx/web:app ${app}`);
      });

      it('should support using {projectRoot} in options blocks in project.json', async () => {
        updateJson(`apps/${app}/project.json`, (c) => {
          c.targets['echo'] = {
            command: `node -e 'console.log("{projectRoot}")'`,
          };
          return c;
        });

        const output = runCLI(`echo ${app}`);
        expect(output).toContain(`apps/${app}`);
      });

      it('should support using {projectName} in options blocks in project.json', () => {
        updateJson(`apps/${app}/project.json`, (c) => {
          c.targets['echo'] = {
            command: `node -e 'console.log("{projectName}")'`,
          };
          return c;
        });

        const output = runCLI(`echo ${app}`);
        expect(output).toContain(app);
      });

      it('should support using {projectRoot} in targetDefaults', async () => {
        updateJson(`nx.json`, (json) => {
          json.targetDefaults = {
            echo: {
              command: `node -e 'console.log("{projectRoot}")'`,
            },
          };
          return json;
        });
        updateJson(`apps/${app}/project.json`, (c) => {
          c.targets['echo'] = {};
          return c;
        });
        const output = runCLI(`echo ${app}`);
        expect(output).toContain(`apps/${app}`);
      });

      it('should support using {projectName} in targetDefaults', () => {
        updateJson(`nx.json`, (json) => {
          json.targetDefaults = {
            echo: {
              command: `node -e 'console.log("{projectName}")'`,
            },
          };
          return json;
        });
        updateJson(`apps/${app}/project.json`, (c) => {
          c.targets['echo'] = {};
          return c;
        });
        const output = runCLI(`echo ${app}`);
        expect(output).toContain(app);
      });
    });

    it('should pass env option to nx:run-commands executor', () => {
      const mylib = uniq('mylib');
      runCLI(`generate @nx/js:lib ${mylib}`);

      updateJson(`libs/${mylib}/project.json`, (c) => {
        c.targets['echo'] = {
          executor: 'nx:run-commands',
          options: {
            command: 'node -e "console.log(process.env.ONE)"',
            env: {
              ONE: 'TWO',
            },
          },
        };
        return c;
      });

      const output = runCLI(`echo ${mylib}`);
      expect(output).toContain('TWO');
    });
  });

  describe('Nx Bail', () => {
    it('should stop executing all tasks when one of the tasks fails', async () => {
      const myapp1 = uniq('a');
      const myapp2 = uniq('b');
      runCLI(`generate @nx/web:app ${myapp1}`);
      runCLI(`generate @nx/web:app ${myapp2}`);
      updateJson(`apps/${myapp1}/project.json`, (c) => {
        c.targets['error'] = {
          command: 'echo boom1 && exit 1',
        };
        return c;
      });
      updateJson(`apps/${myapp2}/project.json`, (c) => {
        c.targets['error'] = {
          executor: 'nx:run-commands',
          options: {
            command: 'echo boom2 && exit 1',
          },
        };
        return c;
      });

      let withoutBail = runCLI(`run-many --target=error --parallel=1`, {
        silenceError: true,
      })
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r);

      withoutBail = withoutBail.slice(withoutBail.indexOf('Failed tasks:'));
      expect(withoutBail).toContain(`- ${myapp1}:error`);
      expect(withoutBail).toContain(`- ${myapp2}:error`);

      let withBail = runCLI(`run-many --target=error --parallel=1 --nx-bail`, {
        silenceError: true,
      })
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r);
      withBail = withBail.slice(withBail.indexOf('Failed tasks:'));

      expect(withBail).toHaveLength(2);

      if (withBail[1] === `- ${myapp1}:error`) {
        expect(withBail).not.toContain(`- ${myapp2}:error`);
      } else {
        expect(withBail[1]).toEqual(`- ${myapp2}:error`);
        expect(withBail).not.toContain(`- ${myapp1}:error`);
      }
    });
  });

  describe('run-one', () => {
    it('should build a specific project', () => {
      const myapp = uniq('app');
      runCLI(`generate @nx/web:app ${myapp}`);

      runCLI(`build ${myapp}`);
    }, 10000);

    it('should support project name positional arg non-consecutive to target', () => {
      const myapp = uniq('app');
      runCLI(`generate @nx/web:app ${myapp}`);

      runCLI(`build --verbose ${myapp}`);
    }, 10000);

    it('should run targets from package json', () => {
      const myapp = uniq('app');
      const target = uniq('script');
      const expectedOutput = uniq('myEchoedString');
      const expectedEnvOutput = uniq('myEnvString');

      runCLI(`generate @nx/web:app ${myapp}`);
      updateFile(
        `apps/${myapp}/package.json`,
        JSON.stringify({
          name: myapp,
          scripts: {
            [target]: `echo ${expectedOutput} $ENV_VAR`,
          },
          nx: {
            targets: {
              [target]: {
                configurations: {
                  production: {},
                },
              },
            },
          },
        })
      );

      updateFile(
        `apps/${myapp}/.env.production`,
        `ENV_VAR=${expectedEnvOutput}`
      );

      expect(runCLI(`${target} ${myapp}`)).toContain(expectedOutput);
      expect(runCLI(`${target} ${myapp}`)).not.toContain(expectedEnvOutput);
      expect(runCLI(`${target} ${myapp} --configuration production`)).toContain(
        expectedEnvOutput
      );
    }, 10000);

    it('should run targets inferred from plugin-specified project files', () => {
      // Setup an app to extend
      const myapp = uniq('app');
      runCLI(`generate @nx/web:app ${myapp}`);

      // Register an Nx plugin
      const plugin = `module.exports = {
  projectFilePatterns: ['inferred-project.nxproject'],
  registerProjectTargets: () => ({
    "echo": {
      "executor": "nx:run-commands",
      "options": {
        "command": "echo inferred-target"
      }
    }
  })
}`;
      updateFile('tools/local-plugin/plugin.js', plugin);
      updateFile('nx.json', (c) => {
        const nxJson = JSON.parse(c);
        nxJson.plugins = ['./tools/local-plugin/plugin.js'];
        return JSON.stringify(nxJson, null, 2);
      });

      // Create a custom project file for the app
      updateFile(`apps/${myapp}/inferred-project.nxproject`, 'contents');

      expect(runCLI(`echo ${myapp}`)).toContain('inferred-target');
    });

    it('should build a specific project with the daemon disabled', () => {
      const myapp = uniq('app');
      runCLI(`generate @nx/web:app ${myapp}`);

      const buildWithDaemon = runCLI(`build ${myapp}`, {
        env: { NX_DAEMON: 'false' },
      });

      expect(buildWithDaemon).toContain('Successfully ran target build');

      const buildAgain = runCLI(`build ${myapp}`, {
        env: { NX_DAEMON: 'false' },
      });

      expect(buildAgain).toContain('[local cache]');
    }, 10000);

    it('should build the project when within the project root', () => {
      const myapp = uniq('app');
      runCLI(`generate @nx/web:app ${myapp}`);

      // Should work within the project directory
      expect(runCommand(`cd apps/${myapp}/src && npx nx build`)).toContain(
        `nx run ${myapp}:build`
      );
    }, 10000);

    describe('target defaults + executor specifications', () => {
      it('should be able to run targets with unspecified executor given an appropriate targetDefaults entry', () => {
        const target = uniq('target');
        const lib = uniq('lib');

        updateJson('nx.json', (nxJson) => {
          nxJson.targetDefaults ??= {};
          nxJson.targetDefaults[target] = {
            executor: 'nx:run-commands',
            options: {
              command: `echo Hello from ${target}`,
            },
          };
          return nxJson;
        });

        updateFile(
          `libs/${lib}/project.json`,
          JSON.stringify({
            name: lib,
            targets: {
              [target]: {},
            },
          })
        );

        expect(runCLI(`${target} ${lib} --verbose`)).toContain(
          `Hello from ${target}`
        );
      });

      it('should be able to pull options from targetDefaults based on executor', () => {
        const target = uniq('target');
        const lib = uniq('lib');

        updateJson('nx.json', (nxJson) => {
          nxJson.targetDefaults ??= {};
          nxJson.targetDefaults[`nx:run-commands`] = {
            options: {
              command: `echo Hello from ${target}`,
            },
          };
          return nxJson;
        });

        updateFile(
          `libs/${lib}/project.json`,
          JSON.stringify({
            name: lib,
            targets: {
              [target]: {
                executor: 'nx:run-commands',
              },
            },
          })
        );

        expect(runCLI(`${target} ${lib} --verbose`)).toContain(
          `Hello from ${target}`
        );
      });
    });

    describe('target dependencies', () => {
      let myapp;
      let mylib1;
      let mylib2;
      beforeAll(() => {
        myapp = uniq('myapp');
        mylib1 = uniq('mylib1');
        mylib2 = uniq('mylib1');
        runCLI(`generate @nx/web:app ${myapp}`);
        runCLI(`generate @nx/js:lib ${mylib1}`);
        runCLI(`generate @nx/js:lib ${mylib2}`);

        updateFile(
          `apps/${myapp}/src/main.ts`,
          `
          import "@${proj}/${mylib1}";
          import "@${proj}/${mylib2}";
        `
        );
      });

      it('should be able to include deps using dependsOn', async () => {
        const originalWorkspace = readJson(`apps/${myapp}/project.json`);
        updateJson(`apps/${myapp}/project.json`, (config) => {
          config.targets.prep = {
            executor: 'nx:run-commands',
            options: {
              command: 'echo PREP',
            },
          };
          config.targets.build = {
            dependsOn: ['prep', '^build'],
          };
          return config;
        });

        const output = runCLI(`build ${myapp}`);
        expect(output).toContain(
          `NX   Running target build for project ${myapp} and 3 tasks it depends on`
        );
        expect(output).toContain(myapp);
        expect(output).toContain(mylib1);
        expect(output).toContain(mylib2);
        expect(output).toContain('PREP');

        updateJson(`apps/${myapp}/project.json`, () => originalWorkspace);
      }, 10000);

      it('should be able to include deps using target defaults defined at the root', async () => {
        const nxJson = readJson('nx.json');
        updateJson(`apps/${myapp}/project.json`, (config) => {
          config.targets.prep = {
            command: 'echo PREP > one.txt',
          };
          config.targets.outside = {
            command: 'echo OUTSIDE',
          };
          return config;
        });

        nxJson.targetDefaults = {
          prep: {
            outputs: ['{workspaceRoot}/one.txt'],
            cache: true,
          },
          outside: {
            dependsOn: ['prep'],
            cache: true,
          },
        };
        updateFile('nx.json', JSON.stringify(nxJson));

        const output = runCLI(`outside ${myapp}`);
        expect(output).toContain(
          `NX   Running target outside for project ${myapp} and 1 task it depends on`
        );

        removeFile(`one.txt`);
        runCLI(`outside ${myapp}`);

        checkFilesExist(`one.txt`);
      }, 10000);
    });
  });

  describe('run-many', () => {
    it('should build specific and all projects', () => {
      // This is required to ensure the numbers used in the assertions make sense for this test
      const proj = newProject();
      const appA = uniq('appa-rand');
      const libA = uniq('liba-rand');
      const libB = uniq('libb-rand');
      const libC = uniq('libc-rand');
      const libD = uniq('libd-rand');

      runCLI(`generate @nx/web:app ${appA}`);
      runCLI(`generate @nx/js:lib ${libA} --bundler=tsc --defaults`);
      runCLI(
        `generate @nx/js:lib ${libB} --bundler=tsc --defaults --tags=ui-a`
      );
      runCLI(
        `generate @nx/js:lib ${libC} --bundler=tsc --defaults --tags=ui-b,shared`
      );
      runCLI(`generate @nx/node:lib ${libD} --defaults --tags=api`);

      // libA depends on libC
      updateFile(
        `libs/${libA}/src/lib/${libA}.spec.ts`,
        `
                import '@${proj}/${libC}';
                describe('sample test', () => {
                  it('should test', () => {
                    expect(1).toEqual(1);
                  });
                });
              `
      );

      // testing run many starting'
      const buildParallel = runCLI(
        `run-many --target=build --projects="${libC},${libB}"`
      );
      expect(buildParallel).toContain(`Running target build for 2 projects:`);
      expect(buildParallel).not.toContain(`- ${appA}`);
      expect(buildParallel).not.toContain(`- ${libA}`);
      expect(buildParallel).toContain(`- ${libB}`);
      expect(buildParallel).toContain(`- ${libC}`);
      expect(buildParallel).not.toContain(`- ${libD}`);
      expect(buildParallel).toContain('Successfully ran target build');

      // testing run many --all starting
      const buildAllParallel = runCLI(`run-many --target=build`);
      expect(buildAllParallel).toContain(
        `Running target build for 4 projects:`
      );
      expect(buildAllParallel).toContain(`- ${appA}`);
      expect(buildAllParallel).toContain(`- ${libA}`);
      expect(buildAllParallel).toContain(`- ${libB}`);
      expect(buildAllParallel).toContain(`- ${libC}`);
      expect(buildAllParallel).not.toContain(`- ${libD}`);
      expect(buildAllParallel).toContain('Successfully ran target build');

      // testing run many by tags
      const buildByTagParallel = runCLI(
        `run-many --target=build --projects="tag:ui*"`
      );
      expect(buildByTagParallel).toContain(
        `Running target build for 2 projects:`
      );
      expect(buildByTagParallel).not.toContain(`- ${appA}`);
      expect(buildByTagParallel).not.toContain(`- ${libA}`);
      expect(buildByTagParallel).toContain(`- ${libB}`);
      expect(buildByTagParallel).toContain(`- ${libC}`);
      expect(buildByTagParallel).not.toContain(`- ${libD}`);
      expect(buildByTagParallel).toContain('Successfully ran target build');

      // testing run many with exclude
      const buildWithExcludeParallel = runCLI(
        `run-many --target=build --exclude="${libD},tag:ui*"`
      );
      expect(buildWithExcludeParallel).toContain(
        `Running target build for 2 projects and 1 task they depend on:`
      );
      expect(buildWithExcludeParallel).toContain(`- ${appA}`);
      expect(buildWithExcludeParallel).toContain(`- ${libA}`);
      expect(buildWithExcludeParallel).not.toContain(`- ${libB}`);
      expect(buildWithExcludeParallel).toContain(`${libC}`); // should still include libC as dependency despite exclude
      expect(buildWithExcludeParallel).not.toContain(`- ${libD}`);
      expect(buildWithExcludeParallel).toContain(
        'Successfully ran target build'
      );

      // testing run many when project depends on other projects
      const buildWithDeps = runCLI(
        `run-many --target=build --projects="${libA}"`
      );
      expect(buildWithDeps).toContain(
        `Running target build for project ${libA} and 1 task it depends on:`
      );
      expect(buildWithDeps).not.toContain(`- ${appA}`);
      expect(buildWithDeps).toContain(`- ${libA}`);
      expect(buildWithDeps).toContain(`${libC}`); // build should include libC as dependency
      expect(buildWithDeps).not.toContain(`- ${libB}`);
      expect(buildWithDeps).not.toContain(`- ${libD}`);
      expect(buildWithDeps).toContain('Successfully ran target build');

      // testing run many --configuration
      const buildConfig = runCLI(
        `run-many --target=build --projects="${appA},${libA}" --prod`
      );
      expect(buildConfig).toContain(
        `Running target build for 2 projects and 1 task they depend on:`
      );
      expect(buildConfig).toContain(`run ${appA}:build`);
      expect(buildConfig).toContain(`run ${libA}:build`);
      expect(buildConfig).toContain(`run ${libC}:build`);
      expect(buildConfig).toContain('Successfully ran target build');

      // testing run many with daemon disabled
      const buildWithDaemon = runCLI(`run-many --target=build`, {
        env: { NX_DAEMON: 'false' },
      });
      expect(buildWithDaemon).toContain(`Successfully ran target build`);
    }, 1000000);

    it('should run multiple targets', () => {
      const myapp1 = uniq('myapp');
      const myapp2 = uniq('myapp');
      runCLI(`generate @nx/web:app ${myapp1}`);
      runCLI(`generate @nx/web:app ${myapp2}`);

      let outputs = runCLI(
        // Options with lists can be specified using multiple args or with a delimiter (comma or space).
        `run-many -t build -t test -p ${myapp1} ${myapp2}`
      );
      expect(outputs).toContain('Running targets build, test for 2 projects:');

      outputs = runCLI(`run-many -t build test -p=${myapp1},${myapp2}`);
      expect(outputs).toContain('Running targets build, test for 2 projects:');
    });
  });

  describe('exec', () => {
    let pkg: string;
    let pkg2: string;
    let pkgRoot: string;
    let pkg2Root: string;
    let originalRootPackageJson: PackageJson;

    beforeAll(() => {
      originalRootPackageJson = readJson<PackageJson>('package.json');
      pkg = uniq('package');
      pkg2 = uniq('package');
      pkgRoot = tmpProjPath(path.join('libs', pkg));
      pkg2Root = tmpProjPath(path.join('libs', pkg2));
      runCLI(`generate @nx/js:lib ${pkg} --bundler=none --unitTestRunner=none`);
      runCLI(
        `generate @nx/js:lib ${pkg2} --bundler=none --unitTestRunner=none`
      );

      updateJson<PackageJson>('package.json', (v) => {
        v.workspaces = ['libs/*'];
        return v;
      });

      updateFile(
        `libs/${pkg}/package.json`,
        JSON.stringify(<PackageJson>{
          name: pkg,
          version: '0.0.1',
          scripts: {
            build: 'nx exec -- echo HELLO',
            'build:option': 'nx exec -- echo HELLO WITH OPTION',
          },
          nx: {
            targets: {
              build: {
                cache: true,
              },
            },
          },
        })
      );

      updateFile(
        `libs/${pkg2}/package.json`,
        JSON.stringify(<PackageJson>{
          name: pkg2,
          version: '0.0.1',
          scripts: {
            build: "nx exec -- echo '$NX_PROJECT_NAME'",
          },
        })
      );

      updateJson(`libs/${pkg2}/project.json`, (content) => {
        content['implicitDependencies'] = [pkg];
        return content;
      });
    });

    afterAll(() => {
      updateJson('package.json', () => originalRootPackageJson);
    });

    it('should work for npm scripts', () => {
      const output = runCommand('npm run build', {
        cwd: pkgRoot,
      });
      expect(output).toContain('HELLO');
      expect(output).toContain(`nx run ${pkg}:build`);
    });

    it('should run adhoc tasks in topological order', () => {
      let output = runCLI('exec -- echo HELLO');
      expect(output).toContain('HELLO');

      output = runCLI(`build ${pkg}`);
      expect(output).toContain(pkg);
      expect(output).not.toContain(pkg2);

      output = runCommand('npm run build', {
        cwd: pkgRoot,
      });
      expect(output).toContain(pkg);
      expect(output).not.toContain(pkg2);

      output = runCLI(`exec -- echo '$NX_PROJECT_NAME'`).replace(/\s+/g, ' ');
      expect(output).toContain(pkg);
      expect(output).toContain(pkg2);

      output = runCLI("exec -- echo '$NX_PROJECT_ROOT_PATH'").replace(
        /\s+/g,
        ' '
      );
      expect(output).toContain(`${path.join('libs', pkg)}`);
      expect(output).toContain(`${path.join('libs', pkg2)}`);

      output = runCLI(`exec --projects ${pkg} -- echo WORLD`);
      expect(output).toContain('WORLD');

      output = runCLI(`exec --projects ${pkg} -- echo '$NX_PROJECT_NAME'`);
      expect(output).toContain(pkg);
      expect(output).not.toContain(pkg2);
    });

    it('should work for npm scripts with delimiter', () => {
      const output = runCommand('npm run build:option', { cwd: pkgRoot });
      expect(output).toContain('HELLO WITH OPTION');
      expect(output).toContain(`nx run ${pkg}:"build:option"`);
    });

    it('should pass overrides', () => {
      const output = runCommand('npm run build WORLD', {
        cwd: pkgRoot,
      });
      expect(output).toContain('HELLO WORLD');
    });

    describe('caching', () => {
      it('should cache subsequent calls', () => {
        runCommand('npm run build', {
          cwd: pkgRoot,
        });
        const output = runCommand('npm run build', {
          cwd: pkgRoot,
        });
        expect(output).toContain('Nx read the output from the cache');
      });

      it('should read outputs', () => {
        const nodeCommands = [
          "const fs = require('fs')",
          "fs.mkdirSync('../../tmp/exec-outputs-test', {recursive: true})",
          "fs.writeFileSync('../../tmp/exec-outputs-test/file.txt', 'Outputs')",
        ];
        updateFile(
          `libs/${pkg}/package.json`,
          JSON.stringify(<PackageJson>{
            name: pkg,
            version: '0.0.1',
            scripts: {
              build: `nx exec -- node -e "${nodeCommands.join(';')}"`,
            },
            nx: {
              targets: {
                build: {
                  cache: true,
                  outputs: ['{workspaceRoot}/tmp/exec-outputs-test'],
                },
              },
            },
          })
        );
        runCommand('npm run build', {
          cwd: pkgRoot,
        });
        expect(
          fileExists(tmpProjPath('tmp/exec-outputs-test/file.txt'))
        ).toBeTruthy();
        removeFile('tmp');
        const output = runCommand('npm run build', {
          cwd: pkgRoot,
        });
        expect(output).toContain('[local cache]');
        expect(
          fileExists(tmpProjPath('tmp/exec-outputs-test/file.txt'))
        ).toBeTruthy();
      });
    });
  });
});

import {
  checkFilesExist,
  cleanupProject,
  isWindows,
  newProject,
  readFile,
  readJson,
  readProjectConfig,
  removeFile,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('Nx Running Tests', () => {
  let proj: string;
  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  describe('running targets', () => {
    it('should execute long running tasks', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/web:app ${myapp}`);
      updateProjectConfig(myapp, (c) => {
        c.targets['counter'] = {
          executor: '@nrwl/workspace:counter',
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
      runCLI(`generate @nrwl/node:lib ${mylib}`);

      // Used to restore targets to lib after test
      const original = readProjectConfig(mylib);
      updateProjectConfig(mylib, (j) => {
        delete j.targets;
        return j;
      });

      updateFile(
        `libs/${mylib}/package.json`,
        JSON.stringify({
          name: 'mylib1',
          scripts: { 'echo:dev': `echo ECHOED` },
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

      updateProjectConfig(mylib, (c) => original);
    }, 1000000);
  });

  describe('Nx Bail', () => {
    it('should stop executing all tasks when one of the tasks fails', async () => {
      const myapp1 = uniq('a');
      const myapp2 = uniq('b');
      runCLI(`generate @nrwl/web:app ${myapp1}`);
      runCLI(`generate @nrwl/web:app ${myapp2}`);
      updateProjectConfig(myapp1, (c) => {
        c.targets['error'] = {
          executor: 'nx:run-commands',
          options: {
            command: 'echo boom1 && exit 1',
          },
        };
        return c;
      });
      updateProjectConfig(myapp2, (c) => {
        c.targets['error'] = {
          executor: 'nx:run-commands',
          options: {
            command: 'echo boom2 && exit 1',
          },
        };
        return c;
      });

      let withoutBail = runCLI(`run-many --target=error --all --parallel=1`, {
        silenceError: true,
      })
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r);

      withoutBail = withoutBail.slice(withoutBail.indexOf('Failed tasks:'));
      expect(withoutBail).toContain(`- ${myapp1}:error`);
      expect(withoutBail).toContain(`- ${myapp2}:error`);

      let withBail = runCLI(
        `run-many --target=error --all --parallel=1 --nx-bail`,
        {
          silenceError: true,
        }
      )
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r);
      withBail = withBail.slice(withBail.indexOf('Failed tasks:'));
      expect(withBail).toContain(`- ${myapp1}:error`);
      expect(withBail).not.toContain(`- ${myapp2}:error`);
    });
  });

  describe('run-one', () => {
    it('should build a specific project', () => {
      const myapp = uniq('app');
      runCLI(`generate @nrwl/web:app ${myapp}`);

      runCLI(`build ${myapp}`);
    }, 10000);

    it('should run targets from package json', () => {
      const myapp = uniq('app');
      const target = uniq('script');
      const expectedOutput = uniq('myEchoedString');

      runCLI(`generate @nrwl/web:app ${myapp}`);
      updateFile(
        `apps/${myapp}/package.json`,
        JSON.stringify({
          name: myapp,
          scripts: {
            [target]: `echo ${expectedOutput}`,
          },
        })
      );

      expect(runCLI(`${target} ${myapp}`)).toContain(expectedOutput);
    }, 10000);

    it('should run targets inferred from plugin-specified project files', () => {
      // Setup an app to extend
      const myapp = uniq('app');
      runCLI(`generate @nrwl/web:app ${myapp}`);

      // Register an Nx plugin
      const plugin = `module.exports = {
  projectFilePatterns: ['inferred-project.nxproject'],
  registerProjectTargets: () => ({
    "echo": {
      "executor": "@nrwl/workspace:run-commands",
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

    it('should build a specific project with the daemon enabled', () => {
      const myapp = uniq('app');
      runCLI(`generate @nrwl/web:app ${myapp}`);

      const buildWithDaemon = runCLI(`build ${myapp}`, {
        env: { ...process.env, NX_DAEMON: 'true' },
      });

      expect(buildWithDaemon).toContain('Successfully ran target build');
    }, 10000);

    it('should build the project when within the project root', () => {
      const myapp = uniq('app');
      runCLI(`generate @nrwl/web:app ${myapp}`);

      // Should work within the project directory
      expect(runCommand(`cd apps/${myapp}/src && npx nx build`)).toContain(
        `nx run ${myapp}:build:production`
      );
    }, 10000);

    describe('target dependencies', () => {
      let myapp;
      let mylib1;
      let mylib2;
      beforeAll(() => {
        myapp = uniq('myapp');
        mylib1 = uniq('mylib1');
        mylib2 = uniq('mylib1');
        runCLI(`generate @nrwl/web:app ${myapp}`);
        runCLI(`generate @nrwl/web:lib ${mylib1} --buildable`);
        runCLI(`generate @nrwl/web:lib ${mylib2} --buildable`);

        updateFile(
          `apps/${myapp}/src/main.ts`,
          `
          import "@${proj}/${mylib1}";
          import "@${proj}/${mylib2}";
        `
        );
      });

      it('should be able to include deps using target dependencies', () => {
        const originalWorkspace = readProjectConfig(myapp);
        updateProjectConfig(myapp, (config) => {
          config.targets.prep = {
            executor: 'nx:run-commands',
            options: {
              command: 'echo PREP',
            },
          };
          config.targets.build.dependsOn = ['prep', '^build'];
          return config;
        });

        const output = runCLI(`build ${myapp}`);
        expect(output).toContain(
          `NX   Running target build for project ${myapp} and 3 task(s) it depends on`
        );
        expect(output).toContain(myapp);
        expect(output).toContain(mylib1);
        expect(output).toContain(mylib2);
        expect(output).toContain('PREP');

        updateProjectConfig(myapp, () => originalWorkspace);
      }, 10000);

      it('should be able to include deps using target dependencies defined at the root', () => {
        const originalNxJson = readFile('nx.json');
        const nxJson = readJson('nx.json');
        nxJson.targetDependencies = {
          build: ['^build', '^e2e-extra-entry-to-bust-cache'],
        };
        updateFile('nx.json', JSON.stringify(nxJson));

        const output = runCLI(`build ${myapp}`);
        expect(output).toContain(
          `NX   Running target build for project ${myapp} and 2 task(s) it depends on`
        );
        expect(output).toContain(myapp);
        expect(output).toContain(mylib1);
        expect(output).toContain(mylib2);

        updateFile('nx.json', originalNxJson);
      }, 10000);

      it('should be able to include deps using target defaults defined at the root', () => {
        const nxJson = readJson('nx.json');
        updateProjectConfig(myapp, (config) => {
          config.targets.prep = {
            executor: 'nx:run-commands',
            options: {
              command: 'echo PREP > one.txt',
            },
          };
          config.targets.outside = {
            executor: 'nx:run-commands',
            options: {
              command: 'echo OUTSIDE',
            },
          };
          return config;
        });

        nxJson.tasksRunnerOptions.default.options.cacheableOperations = [
          'prep',
          'outside',
        ];
        nxJson.targetDefaults = {
          prep: {
            outputs: ['one.txt'],
          },
          outside: {
            dependsOn: ['prep'],
          },
        };
        updateFile('nx.json', JSON.stringify(nxJson));

        const output = runCLI(`outside ${myapp}`);
        expect(output).toContain(
          `NX   Running target outside for project ${myapp} and 1 task(s) it depends on`
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

      runCLI(`generate @nrwl/web:app ${appA}`);
      runCLI(`generate @nrwl/js:lib ${libA} --buildable --defaults`);
      runCLI(`generate @nrwl/js:lib ${libB} --buildable --defaults`);
      runCLI(`generate @nrwl/js:lib ${libC} --buildable --defaults`);
      runCLI(`generate @nrwl/node:lib ${libD} --defaults`);

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
      expect(buildParallel).toContain(`Running target build for 2 project(s):`);
      expect(buildParallel).not.toContain(`- ${libA}`);
      expect(buildParallel).toContain(`- ${libB}`);
      expect(buildParallel).toContain(`- ${libC}`);
      expect(buildParallel).not.toContain(`- ${libD}`);
      expect(buildParallel).toContain('Successfully ran target build');

      // testing run many --all starting
      const buildAllParallel = runCLI(`run-many --target=build --all`);
      expect(buildAllParallel).toContain(
        `Running target build for 4 project(s):`
      );
      expect(buildAllParallel).toContain(`- ${appA}`);
      expect(buildAllParallel).toContain(`- ${libA}`);
      expect(buildAllParallel).toContain(`- ${libB}`);
      expect(buildAllParallel).toContain(`- ${libC}`);
      expect(buildAllParallel).not.toContain(`- ${libD}`);
      expect(buildAllParallel).toContain('Successfully ran target build');

      // testing run many when project depends on other projects
      const buildWithDeps = runCLI(
        `run-many --target=build --projects="${libA}"`
      );
      expect(buildWithDeps).toContain(
        `Running target build for 1 project(s) and 1 task(s) they depend on:`
      );
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
        `Running target build for 2 project(s) and 1 task(s) they depend on:`
      );
      expect(buildConfig).toContain(`run ${appA}:build:production`);
      expect(buildConfig).toContain(`run ${libA}:build`);
      expect(buildConfig).toContain(`run ${libC}:build`);
      expect(buildConfig).toContain('Successfully ran target build');

      // testing run many with daemon enabled
      const buildWithDaemon = runCLI(`run-many --target=build --all`, {
        env: { ...process.env, NX_DAEMON: 'true' },
      });
      expect(buildWithDaemon).toContain(`Successfully ran target build`);
    }, 1000000);
  });
});

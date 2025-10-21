import {
  cleanupProject,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { setupRunTests } from './run-setup';

describe('run-one', () => {
  let proj: string;
  beforeAll(() => (proj = setupRunTests()));
  afterAll(() => cleanupProject());

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateJson('nx.json', () => existingNxJson);
  });

  it('should build a specific project', () => {
    const myapp = uniq('app');
    runCLI(`generate @nx/web:app apps/${myapp}`);

    runCLI(`build ${myapp}`);
  }, 10000);

  it('should support project name positional arg non-consecutive to target', () => {
    const myapp = uniq('app');
    runCLI(`generate @nx/web:app apps/${myapp}`);

    runCLI(`build --verbose ${myapp}`);
  }, 10000);

  it('should run targets from package json', () => {
    const myapp = uniq('app');
    const target = uniq('script');
    const expectedOutput = uniq('myEchoedString');
    const expectedEnvOutput = uniq('myEnvString');

    runCLI(`generate @nx/web:app apps/${myapp}`);
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

    updateFile(`apps/${myapp}/.env.production`, `ENV_VAR=${expectedEnvOutput}`);

    expect(runCLI(`${target} ${myapp}`)).toContain(expectedOutput);
    expect(runCLI(`${target} ${myapp}`)).not.toContain(expectedEnvOutput);
    expect(runCLI(`${target} ${myapp} --configuration production`)).toContain(
      expectedEnvOutput
    );
  }, 10000);

  it('should build a specific project with the daemon disabled', () => {
    const myapp = uniq('app');
    runCLI(`generate @nx/web:app ${myapp} --directory=apps/${myapp}`);

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
    runCLI(`generate @nx/web:app ${myapp} --directory=apps/${myapp}`);

    // Should work within the project directory
    expect(runCommand(`cd apps/${myapp}/src && npx nx build`)).toContain(
      `nx run ${myapp}:build`
    );
  }, 10000);

  it('should default to "run" target when only project is specified and it has a run target', () => {
    const myapp = uniq('app');
    runCLI(`generate @nx/web:app apps/${myapp}`);

    // Add a "run" target to the project
    updateJson(`apps/${myapp}/project.json`, (c) => {
      c.targets['run'] = {
        command: 'echo Running the app',
      };
      return c;
    });

    // Running with just the project name should default to the "run" target
    const output = runCLI(`run ${myapp}`);
    expect(output).toContain('Running the app');
    expect(output).toContain(`nx run ${myapp}:run`);
  });

  it('should still require target when project does not have a run target', () => {
    const myapp = uniq('app');
    runCLI(`generate @nx/web:app apps/${myapp}`);

    // Project has no "run" target, so it should fail
    const result = runCLI(`run ${myapp}`, { silenceError: true });
    expect(result).toContain('Both project and target have to be specified');
  });

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
      runCLI(`generate @nx/web:app ${myapp} --directory=apps/${myapp}`);
      runCLI(`generate @nx/js:lib ${mylib1} --directory=libs/${mylib1}`);
      runCLI(`generate @nx/js:lib ${mylib2} --directory=libs/${mylib2}`);

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

      const { removeFile, checkFilesExist } = require('@nx/e2e-utils');
      removeFile(`one.txt`);
      runCLI(`outside ${myapp}`);

      checkFilesExist(`one.txt`);
    }, 10000);
  });
});

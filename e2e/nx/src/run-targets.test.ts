import {
  cleanupProject,
  isWindows,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { PackageJson } from 'nx/src/utils/package-json';
import { setupRunTests } from './run-setup';

describe('Nx Running Tests - running targets', () => {
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

  it('should execute long running tasks', () => {
    const myapp = uniq('myapp');
    runCLI(`generate @nx/web:app apps/${myapp}`);
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

    expect(() => runCLI(`counter ${myapp} --result=false`)).toThrow();
  });

  it('should run npm scripts', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/node:lib libs/${mylib}`);

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
      runCLI(`generate @nx/web:app apps/${app}`);
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
    runCLI(`generate @nx/js:lib libs/${mylib}`);

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

  it('should not run dependencies if --no-dependencies is passed', () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib libs/${mylib}`);

    updateJson(`libs/${mylib}/project.json`, (c) => {
      c.targets['one'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo ONE',
        },
      };
      c.targets['two'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo TWO',
        },
        dependsOn: ['one'],
      };
      c.targets['three'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo THREE',
        },
        dependsOn: ['two'],
      };
      return c;
    });

    const output = runCLI(`one ${mylib} --no-deps`);
    expect(output).toContain('ONE');
    expect(output).not.toContain('TWO');
    expect(output).not.toContain('THREE');
  });
});

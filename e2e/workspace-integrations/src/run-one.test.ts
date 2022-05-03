import {
  cleanupProject,
  newProject,
  readFile,
  readJson,
  readProjectConfig,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('run-one', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => {
    cleanupProject();
  });

  it('should build a specific project', () => {
    const myapp = uniq('app');
    runCLI(`generate @nrwl/react:app ${myapp}`);

    runCLI(`build ${myapp}`);
  }, 10000);

  it('should run targets from package json', () => {
    const myapp = uniq('app');
    const target = uniq('script');
    const expectedOutput = uniq('myEchoedString');

    runCLI(`generate @nrwl/react:app ${myapp}`);
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
    runCLI(`generate @nrwl/react:app ${myapp}`);

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
    runCLI(`generate @nrwl/react:app ${myapp}`);

    const buildWithDaemon = runCLI(`build ${myapp}`, {
      env: { ...process.env, NX_DAEMON: 'true' },
    });

    expect(buildWithDaemon).toContain('Successfully ran target build');
  }, 10000);

  it('should build the project when within the project root', () => {
    const myapp = uniq('app');
    runCLI(`generate @nrwl/react:app ${myapp}`);

    // Should work within the project directory
    expect(runCommand(`cd apps/${myapp}/src && npx nx build`)).toContain(
      `nx run ${myapp}:build:production`
    );
  }, 10000);

  it('should error for invalid configurations', () => {
    const myapp = uniq('app');
    runCLI(`generate @nrwl/react:app ${myapp}`);
    // configuration has to be valid for the initiating project
    expect(() => runCLI(`build ${myapp} -c=invalid`)).toThrow();
  }, 10000);

  describe('target dependencies', () => {
    let myapp;
    let mylib1;
    let mylib2;
    beforeAll(() => {
      myapp = uniq('myapp');
      mylib1 = uniq('mylib1');
      mylib2 = uniq('mylib1');
      runCLI(`generate @nrwl/react:app ${myapp}`);
      runCLI(`generate @nrwl/react:lib ${mylib1} --buildable`);
      runCLI(`generate @nrwl/react:lib ${mylib2} --buildable`);

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
          executor: "nx:run-commands",
          options: {
            command: "echo PREP"
          }
        };
        config.targets.build.dependsOn = [
          "prep",
          {
            target: 'build',
            projects: 'dependencies',
          },
        ];
        return config;
      });

      const output = runCLI(`build ${myapp}`);
      expect(output).toContain(
        `NX   Running target build for project ${myapp} and 3 task(s) it depends on`
      );
      expect(output).toContain(myapp);
      expect(output).toContain(mylib1);
      expect(output).toContain(mylib2);
      expect(output).toContain("PREP");

      updateProjectConfig(myapp, () => originalWorkspace);
    }, 10000);

    it('should be able to include deps using target dependencies defined at the root', () => {
      const originalNxJson = readFile('nx.json');
      const nxJson = readJson('nx.json');
      nxJson.targetDependencies = {
        build: [
          {
            target: 'build',
            projects: 'dependencies',
          },
          /**
           * At the time of writing, the above object is also the default in nx.json, so we need to make an additional change to ensure
           * that the JSON is structurally different and the build results are therefore not read from the cache as part of this test.
           */
          { target: 'e2e-extra-entry-to-bust-cache', projects: 'dependencies' },
        ],
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
  });
});

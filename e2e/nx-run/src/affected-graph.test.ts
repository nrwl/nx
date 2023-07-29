import type { NxJsonConfiguration } from '@nx/devkit';
import {
  getPackageManagerCommand,
  isNotWindows,
  newProject,
  readFile,
  readJson,
  cleanupProject,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
  checkFilesExist,
  isWindows,
  fileExists,
  removeFile,
  readResolvedConfiguration,
} from '@nx/e2e/utils';

describe('Nx Affected and Graph Tests', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  describe('affected:*', () => {
    it('should print, build, and test affected apps', async () => {
      process.env.CI = 'true';
      const myapp = uniq('myapp');
      const myapp2 = uniq('myapp2');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');
      runCLI(`generate @nx/web:app ${myapp}`);
      runCLI(`generate @nx/web:app ${myapp2}`);
      runCLI(`generate @nx/js:lib ${mylib}`);
      runCLI(`generate @nx/js:lib ${mylib2}`);
      runCLI(
        `generate @nx/js:lib ${mypublishablelib} --publishable --importPath=@${proj}/${mypublishablelib} --tags=ui`
      );

      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        `
              import * as x from '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );
      updateFile(
        `libs/${mypublishablelib}/src/lib/${mypublishablelib}.spec.ts`,
        `
              import * as x from '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );

      const affectedApps = runCLI(
        `show projects --affected --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedApps).toContain(myapp);
      expect(affectedApps).not.toContain(myapp2);

      const implicitlyAffectedApps = runCLI(
        'show projects --affected --files="tsconfig.base.json"'
      );
      expect(implicitlyAffectedApps).toContain(myapp);
      expect(implicitlyAffectedApps).toContain(myapp2);

      const noAffectedApps = runCLI(
        'show projects --affected projects --files="README.md"'
      );
      expect(noAffectedApps).not.toContain(myapp);
      expect(noAffectedApps).not.toContain(myapp2);

      const affectedLibs = runCLI(
        `show projects --affected --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedLibs).toContain(mypublishablelib);
      expect(affectedLibs).toContain(mylib);
      expect(affectedLibs).not.toContain(mylib2);

      const implicitlyAffectedLibs = runCLI(
        'show projects --affected --files="tsconfig.base.json"'
      );
      expect(implicitlyAffectedLibs).toContain(mypublishablelib);
      expect(implicitlyAffectedLibs).toContain(mylib);
      expect(implicitlyAffectedLibs).toContain(mylib2);

      const noAffectedLibsNonExistentFile = runCLI(
        'show projects --affected --files="tsconfig.json"'
      );
      expect(noAffectedLibsNonExistentFile).not.toContain(mypublishablelib);
      expect(noAffectedLibsNonExistentFile).not.toContain(mylib);
      expect(noAffectedLibsNonExistentFile).not.toContain(mylib2);

      const noAffectedLibs = runCLI(
        'show projects --affected --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain(mypublishablelib);
      expect(noAffectedLibs).not.toContain(mylib);
      expect(noAffectedLibs).not.toContain(mylib2);

      // build
      const build = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --parallel`
      );
      expect(build).toContain(`Running target build for 3 projects:`);
      expect(build).toContain(`- ${myapp}`);
      expect(build).toContain(`- ${mypublishablelib}`);
      expect(build).not.toContain('is not registered with the build command');
      expect(build).toContain('Successfully ran target build');

      const buildExcluded = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --exclude=${myapp}`
      );
      expect(buildExcluded).toContain(`Running target build for 2 projects:`);
      expect(buildExcluded).toContain(`- ${mypublishablelib}`);

      const buildExcludedByTag = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --exclude=tag:ui`
      );
      expect(buildExcludedByTag).toContain(
        `Running target build for 2 projects:`
      );
      expect(buildExcludedByTag).not.toContain(`- ${mypublishablelib}`);

      // test
      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.element.spec.ts`).replace(
          '.toEqual(1)',
          '.toEqual(2)'
        )
      );

      const failedTests = runCLI(
        `affected:test --files="libs/${mylib}/src/index.ts"`,
        { silenceError: true }
      );
      expect(failedTests).toContain(mylib);
      expect(failedTests).toContain(myapp);
      expect(failedTests).toContain(mypublishablelib);
      expect(failedTests).toContain(`Failed tasks:`);

      // Fix failing Unit Test
      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.element.spec.ts`).replace(
          '.toEqual(2)',
          '.toEqual(1)'
        )
      );
    }, 1000000);
  });

  describe('affected (with git)', () => {
    let myapp;
    let myapp2;
    let mylib;

    beforeEach(() => {
      myapp = uniq('myapp');
      myapp2 = uniq('myapp');
      mylib = uniq('mylib');
      const nxJson: NxJsonConfiguration = readJson('nx.json');

      updateFile('nx.json', JSON.stringify(nxJson));
      runCommand(`git init`);
      runCommand(`git config user.email "test@test.com"`);
      runCommand(`git config user.name "Test"`);
      runCommand(`git config commit.gpgsign false`);
      try {
        runCommand(
          `git add . && git commit -am "initial commit" && git checkout -b main`
        );
      } catch (e) {}
    });

    function generateAll() {
      runCLI(`generate @nx/web:app ${myapp}`);
      runCLI(`generate @nx/web:app ${myapp2}`);
      runCLI(`generate @nx/js:lib ${mylib}`);
      runCommand(`git add . && git commit -am "add all"`);
    }

    it('should not affect other projects by generating a new project', () => {
      // TODO: investigate why affected gives different results on windows
      if (isNotWindows()) {
        runCLI(`generate @nx/web:app ${myapp}`);
        expect(runCLI('print-affected --select projects')).toContain(myapp);
        runCommand(`git add . && git commit -am "add ${myapp}"`);

        runCLI(`generate @nx/web:app ${myapp2}`);
        let output = runCLI('print-affected --select projects');
        expect(output).not.toContain(myapp);
        expect(output).toContain(myapp2);
        runCommand(`git add . && git commit -am "add ${myapp2}"`);

        runCLI(`generate @nx/js:lib ${mylib}`);
        output = runCLI('print-affected --select projects');
        expect(output).not.toContain(myapp);
        expect(output).not.toContain(myapp2);
        expect(output).toContain(mylib);
      }
    }, 1000000);

    it('should detect changes to projects based on tags changes', () => {
      // TODO: investigate why affected gives different results on windows
      if (isNotWindows()) {
        generateAll();
        updateProjectConfig(myapp, (config) => ({
          ...config,
          tags: ['tag'],
        }));
        const output = runCLI('print-affected --select projects');
        expect(output).toContain(myapp);
        expect(output).not.toContain(myapp2);
        expect(output).not.toContain(mylib);
      }
    });

    it('should affect all projects by removing projects', () => {
      generateAll();
      const root = readResolvedConfiguration().projects[mylib].root;
      removeFile(root);
      const output = runCLI('print-affected --select projects');
      expect(output).toContain(myapp);
      expect(output).toContain(myapp2);
      expect(output).not.toContain(mylib);
    });

    it('should detect changes to implicitly dependant projects', () => {
      generateAll();
      updateProjectConfig(myapp, (config) => ({
        ...config,
        implicitDependencies: ['*', `!${myapp2}`],
      }));

      runCommand('git commit -m "setup test"');
      updateFile(`libs/${mylib}/index.html`, '<html></html>');

      const output = runCLI('print-affected --select projects');

      expect(output).toContain(myapp);
      expect(output).not.toContain(myapp2);
      expect(output).toContain(mylib);

      // Clear implicit deps to not interfere with other tests.
      updateProjectConfig(myapp, (config) => ({
        ...config,
        implicitDependencies: [],
      }));
    });

    it('should handle file renames', () => {
      generateAll();

      // Move file
      updateFile(
        `apps/${myapp2}/src/index.html`,
        readFile(`apps/${myapp}/src/index.html`)
      );
      removeFile(`apps/${myapp}/src/index.html`);

      const affectedProjects = runCLI(
        'print-affected --uncommitted --select projects'
      )
        .replace(
          /.*nx print-affected --uncommitted --select projects( --verbose)?\n/,
          ''
        )
        .split(', ');

      expect(affectedProjects).toContain(myapp);
      expect(affectedProjects).toContain(myapp2);
    });
  });

  describe('graph', () => {
    let myapp: string;
    let myapp2: string;
    let myapp3: string;
    let myappE2e: string;
    let myapp2E2e: string;
    let myapp3E2e: string;
    let mylib: string;
    let mylib2: string;

    beforeAll(() => {
      myapp = uniq('myapp');
      myapp2 = uniq('myapp2');
      myapp3 = uniq('myapp3');
      myappE2e = `${myapp}-e2e`;
      myapp2E2e = `${myapp2}-e2e`;
      myapp3E2e = `${myapp3}-e2e`;
      mylib = uniq('mylib');
      mylib2 = uniq('mylib2');

      runCLI(`generate @nx/web:app ${myapp}`);
      runCLI(`generate @nx/web:app ${myapp2}`);
      runCLI(`generate @nx/web:app ${myapp3}`);
      runCLI(`generate @nx/js:lib ${mylib}`);
      runCLI(`generate @nx/js:lib ${mylib2}`);

      runCommand(`git init`);
      runCommand(`git config user.email "test@test.com"`);
      runCommand(`git config user.name "Test"`);
      runCommand(`git config commit.gpgsign false`);
      runCommand(
        `git add . && git commit -am "initial commit" && git checkout -b main`
      );

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
      import '@${proj}/${mylib}';

      const s = {loadChildren: '@${proj}/${mylib2}'};
    `
      );

      updateFile(
        `apps/${myapp2}/src/app/app.element.spec.ts`,
        `import '@${proj}/${mylib}';`
      );

      updateFile(
        `libs/${mylib}/src/${mylib}.spec.ts`,
        `import '@${proj}/${mylib2}';`
      );
    });

    it('graph should output json to file', () => {
      runCLI(`graph --file=project-graph.json`);

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');

      expect(jsonFileContents.graph.dependencies).toEqual(
        expect.objectContaining({
          [myapp3E2e]: [
            {
              source: myapp3E2e,
              target: myapp3,
              type: 'implicit',
            },
          ],
          [myapp2]: [
            {
              source: myapp2,
              target: mylib,
              type: 'static',
            },
          ],
          [myapp2E2e]: [
            {
              source: myapp2E2e,
              target: myapp2,
              type: 'implicit',
            },
          ],
          [mylib]: [
            {
              source: mylib,
              target: mylib2,
              type: 'static',
            },
          ],
          [mylib2]: [],
          [myapp]: [
            {
              source: myapp,
              target: mylib,
              type: 'static',
            },
            { source: myapp, target: mylib2, type: 'dynamic' },
          ],
          [myappE2e]: [
            {
              source: myappE2e,
              target: myapp,
              type: 'implicit',
            },
          ],
          [myapp3]: [],
        })
      );

      runCLI(
        `affected:graph --files="libs/${mylib}/src/index.ts" --file="project-graph.json"`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents2 = readJson('project-graph.json');

      expect(jsonFileContents2.criticalPath).toContain(myapp);
      expect(jsonFileContents2.criticalPath).toContain(myapp2);
      expect(jsonFileContents2.criticalPath).toContain(mylib);
      expect(jsonFileContents2.criticalPath).not.toContain(mylib2);
    }, 1000000);

    if (isNotWindows()) {
      it('graph should output json to file by absolute path', () => {
        runCLI(`graph --file=/tmp/project-graph.json`);

        expect(() => checkFilesExist('/tmp/project-graph.json')).not.toThrow();
      }, 1000000);
    }

    if (isWindows()) {
      it('graph should output json to file by absolute path in Windows', () => {
        runCLI(`graph --file=C:\\tmp\\project-graph.json`);

        expect(fileExists('C:\\tmp\\project-graph.json')).toBeTruthy();
      }, 1000000);
    }

    it('graph should focus requested project', () => {
      runCLI(`graph --focus=${myapp} --file=project-graph.json`);

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);
      expect(projectNames).toContain(myappE2e);

      expect(projectNames).not.toContain(myapp2);
      expect(projectNames).not.toContain(myapp3);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);

    it('graph should exclude requested projects', () => {
      runCLI(
        `graph --exclude=${myappE2e},${myapp2E2e},${myapp3E2e} --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);
      expect(projectNames).toContain(myapp2);
      expect(projectNames).toContain(myapp3);

      expect(projectNames).not.toContain(myappE2e);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);

    it('graph should exclude requested projects that were included by a focus', () => {
      runCLI(
        `graph --focus=${myapp} --exclude=${myappE2e} --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);

      expect(projectNames).not.toContain(myappE2e);
      expect(projectNames).not.toContain(myapp2);
      expect(projectNames).not.toContain(myapp3);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);

    it('graph should output a deployable static website in an html file accompanied by a folder with static assets', () => {
      runCLI(`graph --file=project-graph.html`);

      expect(() => checkFilesExist('project-graph.html')).not.toThrow();
      expect(() => checkFilesExist('static/styles.css')).not.toThrow();
      expect(() => checkFilesExist('static/runtime.js')).not.toThrow();
      expect(() => checkFilesExist('static/main.js')).not.toThrow();
      expect(() => checkFilesExist('static/environment.js')).not.toThrow();

      const environmentJs = readFile('static/environment.js');

      expect(environmentJs).toContain('window.projectGraphResponse');
      expect(environmentJs).toContain('"affected":[]');
    });

    it('graph should output valid json when stdout is specified', () => {
      const result = runCLI(`affected -t build --graph stdout`);
      let model;
      expect(() => (model = JSON.parse(result))).not.toThrow();
      expect(model).toHaveProperty('graph');
      expect(model).toHaveProperty('tasks');
    });

    it('should include affected projects in environment file', () => {
      runCLI(`graph --affected --file=project-graph.html`);

      const environmentJs = readFile('static/environment.js');
      const affectedProjects = environmentJs
        .match(/"affected":\[(.*?)\]/)[1]
        ?.split(',');

      expect(affectedProjects).toContain(`"${myapp}"`);
      expect(affectedProjects).toContain(`"${myappE2e}"`);
      expect(affectedProjects).toContain(`"${myapp2}"`);
      expect(affectedProjects).toContain(`"${myapp2E2e}"`);
      expect(affectedProjects).toContain(`"${mylib}"`);
    });
  });
});

describe('Print-affected', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  it('should print information about affected projects', async () => {
    const myapp = uniq('myapp-a');
    const myapp2 = uniq('myapp-b');
    const mylib = uniq('mylib');
    const mylib2 = uniq('mylib2');
    const mypublishablelib = uniq('mypublishablelib');

    runCLI(`generate @nx/web:app ${myapp}`);
    runCLI(`generate @nx/web:app ${myapp2}`);
    runCLI(`generate @nx/js:lib ${mylib}`);
    runCLI(`generate @nx/js:lib ${mylib2}`);
    runCLI(`generate @nx/js:lib ${mypublishablelib}`);

    const app1ElementSpec = readFile(
      `apps/${myapp}/src/app/app.element.spec.ts`
    );

    updateFile(
      `apps/${myapp}/src/app/app.element.spec.ts`,
      `
        import "@${proj}/${mylib}";
        import "@${proj}/${mypublishablelib}";
        ${app1ElementSpec}
        `
    );

    const app2ElementSpec = readFile(
      `apps/${myapp2}/src/app/app.element.spec.ts`
    );

    updateFile(
      `apps/${myapp2}/src/app/app.element.spec.ts`,
      `
        import "@${proj}/${mylib}";
        import "@${proj}/${mypublishablelib}";
        ${app2ElementSpec}
        `
    );

    const resWithoutTarget = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/app/app.element.spec.ts`,
          {
            silent: true,
          }
        )
      ).stdout
    );
    expect(resWithoutTarget.tasks).toEqual([]);
    compareTwoArrays(resWithoutTarget.projects, [`${myapp}-e2e`, myapp]);

    const resWithTarget = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/app/app.element.spec.ts --target=test`,
          { silent: true }
        )
      ).stdout.trim()
    );

    const { runNx } = getPackageManagerCommand();
    expect(resWithTarget.tasks[0]).toMatchObject({
      id: `${myapp}:test`,
      overrides: {},
      target: {
        project: myapp,
        target: 'test',
      },
      command: `${runNx} run ${myapp}:test`,
      outputs: [`coverage/apps/${myapp}`],
    });
    compareTwoArrays(resWithTarget.projects, [myapp]);

    const resWithTargetWithSelect1 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/app/app.element.spec.ts --target=test --select=projects`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(resWithTargetWithSelect1, myapp);

    const resWithTargetWithSelect2 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/app/app.element.spec.ts --target=test --select="tasks.target.project"`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(resWithTargetWithSelect2, myapp);
  }, 120000);

  function compareTwoSerializedArrays(a: string, b: string) {
    compareTwoArrays(
      a.split(',').map((_) => _.trim()),
      b.split(',').map((_) => _.trim())
    );
  }

  function compareTwoArrays(a: string[], b: string[]) {
    expect(a.sort((x, y) => x.localeCompare(y))).toEqual(
      b.sort((x, y) => x.localeCompare(y))
    );
  }
});

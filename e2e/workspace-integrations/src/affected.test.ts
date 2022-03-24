import type { NxJsonConfiguration } from '@nrwl/devkit';
import {
  getPackageManagerCommand,
  isNotWindows,
  listFiles,
  newProject,
  readFile,
  readJson,
  readProjectConfig,
  cleanupProject,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('affected:*', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));
  afterEach(() => cleanupProject());

  it('should print, build, and test affected apps', async () => {
    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    const mylib = uniq('mylib');
    const mylib2 = uniq('mylib2');
    const mypublishablelib = uniq('mypublishablelib');
    runCLI(`generate @nrwl/react:app ${myapp}`);
    runCLI(`generate @nrwl/react:app ${myapp2}`);
    runCLI(`generate @nrwl/react:lib ${mylib}`);
    runCLI(`generate @nrwl/react:lib ${mylib2}`);
    runCLI(
      `generate @nrwl/react:lib ${mypublishablelib} --publishable --importPath=@${proj}/${mypublishablelib}`
    );

    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      `
              import '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
    );
    updateFile(
      `libs/${mypublishablelib}/src/lib/${mypublishablelib}.module.spec.ts`,
      `
              import '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
    );
    expect(
      (
        await runCLIAsync(
          `affected:apps --files="libs/${mylib}/src/index.ts" --plain`,
          { silent: true }
        )
      ).stdout.trim()
    ).toEqual(myapp);

    const affectedApps = runCLI(
      `affected:apps --files="libs/${mylib}/src/index.ts"`
    );
    expect(affectedApps).toContain(myapp);
    expect(affectedApps).not.toContain(myapp2);
    expect(affectedApps).not.toContain(`${myapp}-e2e`);

    const implicitlyAffectedApps = runCLI(
      'affected:apps --files="tsconfig.base.json"'
    );
    expect(implicitlyAffectedApps).toContain(myapp);
    expect(implicitlyAffectedApps).toContain(myapp2);

    const noAffectedApps = runCLI('affected:apps --files="README.md"');
    expect(noAffectedApps).not.toContain(myapp);
    expect(noAffectedApps).not.toContain(myapp2);

    expect(
      (
        await runCLIAsync(
          `affected:libs --files="libs/${mylib}/src/index.ts" --plain`,
          { silent: true }
        )
      ).stdout.trim()
    ).toEqual(`${mylib} ${mypublishablelib}`);

    const affectedLibs = runCLI(
      `affected:libs --files="libs/${mylib}/src/index.ts"`
    );
    expect(affectedLibs).toContain(mypublishablelib);
    expect(affectedLibs).toContain(mylib);
    expect(affectedLibs).not.toContain(mylib2);

    const implicitlyAffectedLibs = runCLI(
      'affected:libs --files="tsconfig.base.json"'
    );
    expect(implicitlyAffectedLibs).toContain(mypublishablelib);
    expect(implicitlyAffectedLibs).toContain(mylib);
    expect(implicitlyAffectedLibs).toContain(mylib2);

    const noAffectedLibsNonExistentFile = runCLI(
      'affected:libs --files="tsconfig.json"'
    );
    expect(noAffectedLibsNonExistentFile).not.toContain(mypublishablelib);
    expect(noAffectedLibsNonExistentFile).not.toContain(mylib);
    expect(noAffectedLibsNonExistentFile).not.toContain(mylib2);

    const noAffectedLibs = runCLI('affected:libs --files="README.md"');
    expect(noAffectedLibs).not.toContain(mypublishablelib);
    expect(noAffectedLibs).not.toContain(mylib);
    expect(noAffectedLibs).not.toContain(mylib2);

    // build
    const build = runCLI(
      `affected:build --files="libs/${mylib}/src/index.ts" --parallel`
    );
    expect(build).toContain(`Running target build for 2 project(s):`);
    expect(build).toContain(`- ${myapp}`);
    expect(build).toContain(`- ${mypublishablelib}`);
    expect(build).not.toContain('is not registered with the build command');
    expect(build).toContain('Successfully ran target build');

    const buildExcluded = runCLI(
      `affected:build --files="libs/${mylib}/src/index.ts" --exclude ${myapp}`
    );
    expect(buildExcluded).toContain(`Running target build for 1 project(s):`);
    expect(buildExcluded).toContain(`- ${mypublishablelib}`);

    // test
    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
        '.toEqual(1)',
        '.toEqual(2)'
      )
    );

    const failedTests = runCLI(
      `affected:test --files="libs/${mylib}/src/index.ts"`,
      { silenceError: true }
    );
    expect(failedTests).toContain(`Running target test for 3 project(s):`);
    expect(failedTests).toContain(`- ${mylib}`);
    expect(failedTests).toContain(`- ${myapp}`);
    expect(failedTests).toContain(`- ${mypublishablelib}`);
    expect(failedTests).toContain(`Failed tasks:`);

    // Fix failing Unit Test
    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
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
    newProject();
    const nxJson: NxJsonConfiguration = readJson('nx.json');

    delete nxJson.implicitDependencies;

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
  afterAll(() => cleanupProject());

  function generateAll() {
    runCLI(`generate @nrwl/angular:app ${myapp}`);
    runCLI(`generate @nrwl/angular:app ${myapp2}`);
    runCLI(`generate @nrwl/angular:lib ${mylib}`);
    runCommand(`git add . && git commit -am "add all"`);
  }

  it('should not affect other projects by generating a new project', () => {
    // TODO: investigate why affected gives different results on windows
    if (isNotWindows()) {
      runCLI(`generate @nrwl/angular:app ${myapp}`);
      expect(runCLI('affected:apps')).toContain(myapp);
      runCommand(`git add . && git commit -am "add ${myapp}"`);

      runCLI(`generate @nrwl/angular:app ${myapp2}`);
      expect(runCLI('affected:apps')).not.toContain(myapp);
      expect(runCLI('affected:apps')).toContain(myapp2);
      runCommand(`git add . && git commit -am "add ${myapp2}"`);

      runCLI(`generate @nrwl/angular:lib ${mylib}`);
      expect(runCLI('affected:apps')).not.toContain(myapp);
      expect(runCLI('affected:apps')).not.toContain(myapp2);
      expect(runCLI('affected:libs')).toContain(mylib);
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
      expect(runCLI('affected:apps')).toContain(myapp);
      expect(runCLI('affected:apps')).not.toContain(myapp2);
      expect(runCLI('affected:libs')).not.toContain(mylib);
    }
  });

  it('should detect changes to projects based on the workspace.json', () => {
    // TODO: investigate why affected gives different results on windows
    if (isNotWindows()) {
      generateAll();
      updateProjectConfig(myapp, (config) => ({
        ...config,
        prefix: 'my-app',
      }));

      expect(runCLI('affected:apps')).toContain(myapp);
      expect(runCLI('affected:apps')).not.toContain(myapp2);
      expect(runCLI('affected:libs')).not.toContain(mylib);
    }
  });

  it('should affect all projects by removing projects', () => {
    generateAll();
    updateFile(workspaceConfigName(), (old) => {
      const workspaceJson = JSON.parse(old);
      delete workspaceJson.projects[mylib];
      return JSON.stringify(workspaceJson, null, 2);
    });
    expect(runCLI('affected:apps')).toContain(myapp);
    expect(runCLI('affected:apps')).toContain(myapp2);
    expect(runCLI('affected:libs')).not.toContain(mylib);
  });
});

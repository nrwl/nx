import { NxJson } from '@nrwl/workspace';
import {
  getPackageManagerCommand,
  listFiles,
  newProject,
  readFile,
  readJson,
  removeProject,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('run-one', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should build specific project', () => {
    const myapp = uniq('myapp');
    const mylib1 = uniq('mylib1');
    const mylib2 = uniq('mylib1');
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

    // configuration has to be valid for the initiating project
    expect(() => runCLI(`build ${myapp} -c=invalid`)).toThrow();
    expect(runCommand(`cd apps/${myapp}-e2e/src && npx nx lint`)).toContain(
      `nx run ${myapp}-e2e:lint`
    );

    // configuration doesn't have to exists for deps (here only the app has production)
    const buildWithDeps = runCLI(`build ${myapp} --with-deps --prod`);
    expect(buildWithDeps).toContain(`Running target "build" succeeded`);
    expect(buildWithDeps).toContain(`nx run ${myapp}:build:production`);
    expect(buildWithDeps).toContain(`nx run ${mylib1}:build`);
    expect(buildWithDeps).toContain(`nx run ${mylib2}:build`);

    const testsWithDeps = runCLI(`test ${myapp} --with-deps`);
    expect(testsWithDeps).toContain(
      `NX  Running target test for project ${myapp} and its 2 deps`
    );
    expect(testsWithDeps).toContain(myapp);
    expect(testsWithDeps).toContain(mylib1);
    expect(testsWithDeps).toContain(mylib2);

    const testsWithoutDeps = runCLI(`test ${myapp}`);
    expect(testsWithoutDeps).not.toContain(mylib1);
  }, 1000000);
});

describe('run-many', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should build specific and all projects', () => {
    const appA = uniq('appa-rand');
    const libA = uniq('liba-rand');
    const libB = uniq('libb-rand');
    const libC = uniq('libc-rand');
    const libD = uniq('libd-rand');

    runCLI(`generate @nrwl/angular:app ${appA}`);
    runCLI(`generate @nrwl/angular:lib ${libA} --buildable --defaults`);
    runCLI(`generate @nrwl/angular:lib ${libB} --buildable --defaults`);
    runCLI(`generate @nrwl/angular:lib ${libC} --buildable --defaults`);
    runCLI(`generate @nrwl/angular:lib ${libD} --defaults`);

    // libA depends on libC
    updateFile(
      `libs/${libA}/src/lib/${libA}.module.spec.ts`,
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
    expect(buildParallel).toContain(`Running target build for projects:`);
    expect(buildParallel).not.toContain(`- ${libA}`);
    expect(buildParallel).toContain(`- ${libB}`);
    expect(buildParallel).toContain(`- ${libC}`);
    expect(buildParallel).not.toContain(`- ${libD}`);
    expect(buildParallel).toContain('Running target "build" succeeded');

    // testing run many --all starting
    const buildAllParallel = runCLI(`run-many --target=build --all`);
    expect(buildAllParallel).toContain(`Running target build for projects:`);
    expect(buildAllParallel).toContain(`- ${libA}`);
    expect(buildAllParallel).toContain(`- ${libB}`);
    expect(buildAllParallel).toContain(`- ${libC}`);
    expect(buildAllParallel).not.toContain(`- ${libD}`);
    expect(buildAllParallel).toContain('Running target "build" succeeded');

    // testing run many --with-deps
    const buildWithDeps = runCLI(
      `run-many --target=build --projects="${libA}" --with-deps`
    );
    expect(buildWithDeps).toContain(`Running target build for projects:`);
    expect(buildWithDeps).toContain(`- ${libA}`);
    expect(buildWithDeps).toContain(`- ${libC}`);
    expect(buildWithDeps).not.toContain(`- ${libB}`);
    expect(buildWithDeps).not.toContain(`- ${libD}`);
    expect(buildWithDeps).toContain('Running target "build" succeeded');

    // testing run many --configuration
    const buildConfig = runCLI(
      `run-many --target=build --projects="${appA},${libA}" --prod`
    );
    expect(buildConfig).toContain(`Running target build for projects:`);
    expect(buildConfig).toContain(`run ${appA}:build:production`);
    expect(buildConfig).toContain(`run ${libA}:build:production`);
    expect(buildConfig).toContain('Running target "build" succeeded');
  }, 1000000);

  it('should run only failed projects', () => {
    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    runCLI(`generate @nrwl/angular:app ${myapp}`);
    runCLI(`generate @nrwl/angular:app ${myapp2}`);

    // set broken test for myapp
    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      `
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(2);
                });
              });
            `
    );

    const failedTests = runCLI(`run-many --target=test --all`, {
      silenceError: true,
    });
    expect(failedTests).toContain(`Running target test for projects:`);
    expect(failedTests).toContain(`- ${myapp}`);
    expect(failedTests).toContain(`- ${myapp2}`);
    expect(failedTests).toContain(`Failed projects:`);
    expect(readJson('node_modules/.cache/nx/results.json')).toEqual({
      command: 'test',
      results: {
        [myapp]: false,
        [myapp2]: true,
      },
    });

    // Fix failing Unit Test
    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
        '.toEqual(2)',
        '.toEqual(1)'
      )
    );

    const isolatedTests = runCLI(`run-many --target=test --all --only-failed`);
    expect(isolatedTests).toContain(`Running target test for projects`);
    expect(isolatedTests).toContain(`- ${myapp}`);
    expect(isolatedTests).not.toContain(`- ${myapp2}`);

    const interpolatedTests = runCLI(`run-many --target=test --all`);
    expect(interpolatedTests).toContain(`Running target \"test\" succeeded`);
  }, 1000000);
});

describe('affected:*', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => removeProject({ onlyOnCI: true }));

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
      'affected:libs --files="tsconfig.json"'
    );
    expect(implicitlyAffectedLibs).toContain(mypublishablelib);
    expect(implicitlyAffectedLibs).toContain(mylib);
    expect(implicitlyAffectedLibs).toContain(mylib2);

    const noAffectedLibs = runCLI('affected:libs --files="README.md"');
    expect(noAffectedLibs).not.toContain(mypublishablelib);
    expect(noAffectedLibs).not.toContain(mylib);
    expect(noAffectedLibs).not.toContain(mylib2);

    // build
    const build = runCLI(
      `affected:build --files="libs/${mylib}/src/index.ts" --parallel`
    );
    expect(build).toContain(`Running target build for projects:`);
    expect(build).toContain(`- ${myapp}`);
    expect(build).toContain(`- ${mypublishablelib}`);
    expect(build).not.toContain('is not registered with the build command');
    expect(build).toContain('Running target "build" succeeded');

    const buildExcluded = runCLI(
      `affected:build --files="libs/${mylib}/src/index.ts" --exclude ${myapp}`
    );
    expect(buildExcluded).toContain(`Running target build for projects:`);
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
    expect(failedTests).toContain(`Running target test for projects:`);
    expect(failedTests).toContain(`- ${mylib}`);
    expect(failedTests).toContain(`- ${myapp}`);
    expect(failedTests).toContain(`- ${mypublishablelib}`);
    expect(failedTests).toContain(`Failed projects:`);
    expect(failedTests).toContain(
      'You can isolate the above projects by passing: --only-failed'
    );
    expect(readJson('node_modules/.cache/nx/results.json')).toEqual({
      command: 'test',
      results: {
        [myapp]: false,
        [mylib]: true,
        [mypublishablelib]: true,
      },
    });

    // Fix failing Unit Test
    updateFile(
      `apps/${myapp}/src/app/app.component.spec.ts`,
      readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
        '.toEqual(2)',
        '.toEqual(1)'
      )
    );

    const isolatedTests = runCLI(
      `affected:test --files="libs/${mylib}/src/index.ts" --only-failed`
    );
    expect(isolatedTests).toContain(`Running target test for projects`);
    expect(isolatedTests).toContain(`- ${myapp}`);

    const interpolatedTests = runCLI(
      `affected --target test --files="libs/${mylib}/src/index.ts" --jest-config {project.root}/jest.config.js`
    );
    expect(interpolatedTests).toContain(`Running target \"test\" succeeded`);
  }, 1000000);
});

describe('affected (with git)', () => {
  let myapp = uniq('myapp');
  let myapp2 = uniq('myapp');
  let mylib = uniq('mylib');

  beforeAll(() => newProject());

  afterAll(() => removeProject({ onlyOnCI: true }));

  it('should not affect other projects by generating a new project', () => {
    const nxJson: NxJson = readJson('nx.json');

    delete nxJson.implicitDependencies;

    updateFile('nx.json', JSON.stringify(nxJson));
    runCommand(`git init`);
    runCommand(`git config user.email "test@test.com"`);
    runCommand(`git config user.name "Test"`);
    runCommand(
      `git add . && git commit -am "initial commit" && git checkout -b master`
    );
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
    runCommand(`git add . && git commit -am "add ${mylib}"`);
  }, 1000000);

  it('should detect changes to projects based on the nx.json', () => {
    const nxJson: NxJson = readJson('nx.json');

    nxJson.projects[myapp].tags = ['tag'];
    updateFile('nx.json', JSON.stringify(nxJson));
    expect(runCLI('affected:apps')).toContain(myapp);
    expect(runCLI('affected:apps')).not.toContain(myapp2);
    expect(runCLI('affected:libs')).not.toContain(mylib);
    runCommand(`git add . && git commit -am "add tag to ${myapp}"`);
  });

  it('should detect changes to projects based on the workspace.json', () => {
    const workspaceJson = readJson(workspaceConfigName());

    workspaceJson.projects[myapp].prefix = 'my-app';
    updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));
    expect(runCLI('affected:apps')).toContain(myapp);
    expect(runCLI('affected:apps')).not.toContain(myapp2);
    expect(runCLI('affected:libs')).not.toContain(mylib);
    runCommand(`git add . && git commit -am "change prefix for ${myapp}"`);
  });

  it('should affect all projects by removing projects', () => {
    const workspaceJson = readJson(workspaceConfigName());
    delete workspaceJson.projects[mylib];
    updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));

    const nxJson = readJson('nx.json');
    delete nxJson.projects[mylib];
    updateFile('nx.json', JSON.stringify(nxJson));

    expect(runCLI('affected:apps')).toContain(myapp);
    expect(runCLI('affected:apps')).toContain(myapp2);
    expect(runCLI('affected:libs')).not.toContain(mylib);
    runCommand(`git add . && git commit -am "remove ${mylib}"`);
  });
});

describe('print-affected', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should print information about affected projects', async () => {
    const myapp = uniq('myapp-a');
    const myapp2 = uniq('myapp-b');
    const mylib = uniq('mylib');
    const mylib2 = uniq('mylib2');
    const mypublishablelib = uniq('mypublishablelib');

    runCLI(`generate @nrwl/react:app ${myapp}`);
    runCLI(`generate @nrwl/react:app ${myapp2}`);
    runCLI(`generate @nrwl/react:lib ${mylib}`);
    runCLI(`generate @nrwl/react:lib ${mylib2}`);
    runCLI(`generate @nrwl/react:lib ${mypublishablelib} --buildable`);

    updateFile(
      `apps/${myapp}/src/main.tsx`,
      `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@${proj}/${mylib}";
          import "@${proj}/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));

          `
    );

    updateFile(
      `apps/${myapp2}/src/main.tsx`,
      `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@${proj}/${mylib}";
          import "@${proj}/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));
          `
    );

    const resWithoutTarget = JSON.parse(
      (
        await runCLIAsync(`print-affected --files=apps/${myapp}/src/main.tsx`, {
          silent: true,
        })
      ).stdout
    );
    expect(resWithoutTarget.tasks).toEqual([]);
    compareTwoArrays(resWithoutTarget.projects, [`${myapp}-e2e`, myapp]);

    const resWithTarget = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/main.tsx --target=test`,
          { silent: true }
        )
      ).stdout.trim()
    );

    const { runNx } = getPackageManagerCommand({
      scriptsPrependNodePath: false,
    });
    expect(resWithTarget.tasks[0]).toMatchObject({
      id: `${myapp}:test`,
      overrides: {},
      target: {
        project: myapp,
        target: 'test',
      },
      command: `${runNx} test ${myapp}`,
      outputs: [`coverage/apps/${myapp}`],
    });
    expect(resWithTarget.tasks[0].hash).toBeDefined();
    compareTwoArrays(resWithTarget.projects, [`${myapp}-e2e`, myapp]);

    const resWithDeps = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/main.tsx --target=build --with-deps`,
          { silent: true }
        )
      ).stdout
    );

    expect(resWithDeps.tasks[0]).toMatchObject({
      id: `${myapp}:build`,
      overrides: {},
      target: {
        project: myapp,
        target: 'build',
      },
      command: `${runNx} build ${myapp}`,
      outputs: [`dist/apps/${myapp}`],
    });
    expect(resWithDeps.tasks[0].hash).toBeDefined();

    expect(resWithDeps.tasks[1]).toMatchObject({
      id: `${mypublishablelib}:build`,
      overrides: {},
      target: {
        project: mypublishablelib,
        target: 'build',
      },
      command: `${runNx} build ${mypublishablelib}`,
      outputs: [`dist/libs/${mypublishablelib}`],
    });
    expect(resWithDeps.tasks[1].hash).toBeDefined();

    compareTwoArrays(resWithDeps.projects, [
      mylib,
      mypublishablelib,
      myapp,
      `${myapp}-e2e`,
    ]);

    const resWithTargetWithSelect1 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/main.tsx --target=test --select=projects`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(
      resWithTargetWithSelect1,
      `${myapp}-e2e, ${myapp}`
    );

    const resWithTargetWithSelect2 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/main.tsx --target=test --select="tasks.target.project"`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(resWithTargetWithSelect2, `${myapp}`);
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

describe('cache', () => {
  beforeEach(() => newProject());

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should cache command execution', async () => {
    const myapp1 = uniq('myapp1');
    const myapp2 = uniq('myapp2');
    runCLI(`generate @nrwl/web:app ${myapp1}`);
    runCLI(`generate @nrwl/web:app ${myapp2}`);
    const files = `--files="apps/${myapp1}/src/main.ts,apps/${myapp2}/src/main.ts"`;

    // run build with caching
    // --------------------------------------------
    const outputThatPutsDataIntoCache = runCLI(`affected:build ${files}`);
    const filesApp1 = listFiles(`dist/apps/${myapp1}`);
    const filesApp2 = listFiles(`dist/apps/${myapp2}`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain(
      'read the output from cache'
    );

    rmDist();

    const outputWithBothBuildTasksCached = runCLI(`affected:build ${files}`);
    expect(outputWithBothBuildTasksCached).toContain(
      'read the output from cache'
    );
    expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
    expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
    expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

    // run with skipping cache
    const outputWithBothBuildTasksCachedButSkipped = runCLI(
      `affected:build ${files} --skip-nx-cache`
    );
    expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
      `read the output from cache`
    );

    // touch myapp1
    // --------------------------------------------
    updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
      return `${c}\n//some comment`;
    });
    const outputWithBuildApp2Cached = runCLI(`affected:build ${files}`);
    expect(outputWithBuildApp2Cached).toContain('read the output from cache');
    expectCached(outputWithBuildApp2Cached, [myapp2]);

    // touch package.json
    // --------------------------------------------
    updateFile(`package.json`, (c) => {
      const r = JSON.parse(c);
      r.description = 'different';
      return JSON.stringify(r);
    });
    const outputWithNoBuildCached = runCLI(`affected:build ${files}`);
    expect(outputWithNoBuildCached).not.toContain('read the output from cache');

    // build individual project with caching
    const individualBuildWithCache = runCLI(`build ${myapp1}`);
    expect(individualBuildWithCache).toContain('from cache');

    // skip caching when building individual projects
    const individualBuildWithSkippedCache = runCLI(
      `build ${myapp1} --skip-nx-cache`
    );
    expect(individualBuildWithSkippedCache).not.toContain('from cache');

    // run lint with caching
    // --------------------------------------------
    const outputWithNoLintCached = runCLI(`affected:lint ${files}`);
    expect(outputWithNoLintCached).not.toContain('read the output from cache');

    const outputWithBothLintTasksCached = runCLI(`affected:lint ${files}`);
    expect(outputWithBothLintTasksCached).toContain(
      'read the output from cache'
    );
    expectCached(outputWithBothLintTasksCached, [
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ]);

    // run without caching
    // --------------------------------------------

    // disable caching
    // --------------------------------------------
    updateFile('nx.json', (c) => {
      const nxJson = JSON.parse(c);
      nxJson.tasksRunnerOptions = {
        default: {
          options: {
            cacheableOperations: [],
          },
        },
      };
      return JSON.stringify(nxJson, null, 2);
    });

    const outputWithoutCachingEnabled1 = runCLI(`affected:build ${files}`);

    expect(outputWithoutCachingEnabled1).not.toContain(
      'read the output from cache'
    );

    const outputWithoutCachingEnabled2 = runCLI(`affected:build ${files}`);
    expect(outputWithoutCachingEnabled2).not.toContain(
      'read the output from cache'
    );
  }, 120000);

  it('should only cache specific files if build outputs is configured with specific files', async () => {
    const mylib1 = uniq('mylib1');
    runCLI(`generate @nrwl/react:lib ${mylib1} --buildable`);

    // Update outputs in workspace.json to just be a particular file
    const workspaceJson = readJson(workspaceConfigName());

    workspaceJson.projects[mylib1].targets['build-base'] = {
      ...workspaceJson.projects[mylib1].targets.build,
    };
    workspaceJson.projects[mylib1].targets.build = {
      executor: '@nrwl/workspace:run-commands',
      outputs: [`dist/libs/${mylib1}/${mylib1}.esm.js`],
      options: {
        commands: [
          {
            command: `npm run nx run ${mylib1}:build-base`,
          },
        ],
        parallel: false,
      },
    };
    updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));

    // run build with caching
    // --------------------------------------------
    const outputThatPutsDataIntoCache = runCLI(`run ${mylib1}:build`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain('from cache');

    rmDist();

    const outputWithBuildTasksCached = runCLI(`run ${mylib1}:build`);
    expect(outputWithBuildTasksCached).toContain('from cache');
    expectCached(outputWithBuildTasksCached, [mylib1]);
    // Ensure that only the specific file in outputs was copied to cache
    expect(listFiles(`dist/libs/${mylib1}`)).toEqual([`${mylib1}.esm.js`]);
  }, 120000);

  function expectCached(
    actualOutput: string,
    expectedCachedProjects: string[]
  ) {
    const cachedProjects = [];
    const lines = actualOutput.split('\n');
    lines.forEach((s, i) => {
      if (s.startsWith(`> nx run`)) {
        const projectName = s.split(`> nx run `)[1].split(':')[0].trim();
        if (s.indexOf('from cache') > -1) {
          cachedProjects.push(projectName);
        }
      }
    });

    cachedProjects.sort((a, b) => a.localeCompare(b));
    expectedCachedProjects.sort((a, b) => a.localeCompare(b));
    expect(cachedProjects).toEqual(expectedCachedProjects);
  }
});

describe('workspace structure', () => {
  beforeEach(() => newProject());

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should have a vscode/extensions.json file created', () => {
    const extensions = readJson('.vscode/extensions.json');
    expect(extensions).toEqual({
      recommendations: [
        'ms-vscode.vscode-typescript-tslint-plugin',
        'esbenp.prettier-vscode',
      ],
    });
  });
});

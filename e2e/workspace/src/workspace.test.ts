import { NxJson } from '@nrwl/workspace';
import {
  ensureProject,
  forEachCli,
  listFiles,
  newProject,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

let originalCIValue: any;

forEachCli((cliName) => {
  const cliCommand = cliName === 'angular' ? 'ng' : 'nx';

  /**
   * Setting CI=true makes it simpler to configure assertions around output, as there
   * won't be any colors.
   */
  beforeAll(() => {
    originalCIValue = process.env.CI;
    process.env.CI = 'true';
  });
  afterAll(() => {
    process.env.CI = originalCIValue;
  });

  describe('run-one', () => {
    it('should build specific project', () => {
      ensureProject();
      const myapp = uniq('myapp');
      const mylib1 = uniq('mylib1');
      const mylib2 = uniq('mylib1');
      runCLI(`generate @nrwl/react:app ${myapp}`);
      runCLI(`generate @nrwl/react:lib ${mylib1} --publishable`);
      runCLI(`generate @nrwl/react:lib ${mylib2} --publishable`);

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
          import "@proj/${mylib1}";
          import "@proj/${mylib2}";
        `
      );

      const buildWithDeps = runCLI(`build ${myapp} --with-deps --prod`);
      expect(buildWithDeps).toContain(`Running target "build" succeeded`);
      expect(buildWithDeps).toContain(
        `${cliCommand} run ${myapp}:build:production`
      );
      expect(buildWithDeps).toContain(`${cliCommand} run ${mylib1}:build`);
      expect(buildWithDeps).toContain(`${cliCommand} run ${mylib2}:build`);

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
    it('should build specific and all projects', () => {
      newProject();
      const appA = uniq('appa-rand');
      const libA = uniq('liba-rand');
      const libB = uniq('libb-rand');
      const libC = uniq('libc-rand');
      const libD = uniq('libd-rand');

      runCLI(`generate @nrwl/angular:app ${appA}`);
      runCLI(`generate @nrwl/angular:lib ${libA} --publishable --defaults`);
      runCLI(`generate @nrwl/angular:lib ${libB} --publishable --defaults`);
      runCLI(`generate @nrwl/angular:lib ${libC} --publishable --defaults`);
      runCLI(`generate @nrwl/angular:lib ${libD} --defaults`);

      // libA depends on libC
      updateFile(
        `libs/${libA}/src/lib/${libA}.module.spec.ts`,
        `
              import '@proj/${libC}';
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
      ensureProject();
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

      const isolatedTests = runCLI(
        `run-many --target=test --all --only-failed`
      );
      expect(isolatedTests).toContain(`Running target test for projects`);
      expect(isolatedTests).toContain(`- ${myapp}`);
      expect(isolatedTests).not.toContain(`- ${myapp2}`);

      const interpolatedTests = runCLI(`run-many --target=test --all`);
      expect(interpolatedTests).toContain(`Running target \"test\" succeeded`);
    }, 1000000);
  });

  describe('affected:*', () => {
    it('should print, build, and test affected apps', () => {
      ensureProject();
      const myapp = uniq('myapp');
      const myapp2 = uniq('myapp2');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');
      runCLI(`generate @nrwl/angular:app ${myapp}`);
      runCLI(`generate @nrwl/angular:app ${myapp2}`);
      runCLI(`generate @nrwl/angular:lib ${mylib}`);
      runCLI(`generate @nrwl/angular:lib ${mylib2}`);
      runCLI(`generate @nrwl/angular:lib ${mypublishablelib} --publishable`);

      updateFile(
        `apps/${myapp}/src/app/app.component.spec.ts`,
        `
              import '@proj/${mylib}';
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
              import '@proj/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );
      expect(
        runCommand(
          `npm run affected:apps -- --files="libs/${mylib}/src/index.ts" --plain`
        ).split('\n')[4]
      ).toEqual(myapp);

      const affectedApps = runCommand(
        `npm run affected:apps -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedApps).toContain(myapp);
      expect(affectedApps).not.toContain(myapp2);
      expect(affectedApps).not.toContain(`${myapp}-e2e`);

      const implicitlyAffectedApps = runCommand(
        'npm run affected:apps -- --files="tsconfig.json"'
      );
      expect(implicitlyAffectedApps).toContain(myapp);
      expect(implicitlyAffectedApps).toContain(myapp2);

      const noAffectedApps = runCommand(
        'npm run affected:apps -- --files="README.md"'
      );
      expect(noAffectedApps).not.toContain(myapp);
      expect(noAffectedApps).not.toContain(myapp2);

      expect(
        runCommand(
          `npm run affected:libs -- --files="libs/${mylib}/src/index.ts" --plain`
        ).split('\n')[4]
      ).toEqual(`${mylib} ${mypublishablelib}`);

      const affectedLibs = runCommand(
        `npm run affected:libs -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedLibs).toContain(mypublishablelib);
      expect(affectedLibs).toContain(mylib);
      expect(affectedLibs).not.toContain(mylib2);

      const implicitlyAffectedLibs = runCommand(
        'npm run affected:libs -- --files="tsconfig.json"'
      );
      expect(implicitlyAffectedLibs).toContain(mypublishablelib);
      expect(implicitlyAffectedLibs).toContain(mylib);
      expect(implicitlyAffectedLibs).toContain(mylib2);

      const noAffectedLibs = runCommand(
        'npm run affected:libs -- --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain(mypublishablelib);
      expect(noAffectedLibs).not.toContain(mylib);
      expect(noAffectedLibs).not.toContain(mylib2);

      // build
      const build = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --parallel`
      );
      expect(build).toContain(`Running target build for projects:`);
      expect(build).toContain(`- ${myapp}`);
      expect(build).toContain(`- ${mypublishablelib}`);
      expect(build).not.toContain('is not registered with the build command');
      expect(build).toContain('Running target "build" succeeded');

      const buildExcluded = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --exclude ${myapp}`
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

      const failedTests = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts"`
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

      const isolatedTests = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts" --only-failed`
      );
      expect(isolatedTests).toContain(`Running target test for projects`);
      expect(isolatedTests).toContain(`- ${myapp}`);

      const interpolatedTests = runCommand(
        `npm run affected -- --target test --files="libs/${mylib}/src/index.ts" -- --jest-config {project.root}/jest.config.js`
      );
      expect(interpolatedTests).toContain(`Running target \"test\" succeeded`);
    }, 1000000);
  });

  describe('affected (with git)', () => {
    let myapp = uniq('myapp');
    let myapp2 = uniq('myapp');
    let mylib = uniq('mylib');
    it('should not affect other projects by generating a new project', () => {
      ensureProject();

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
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      runCommand(`git add . && git commit -am "add ${myapp}"`);

      runCLI(`generate @nrwl/angular:app ${myapp2}`);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp);
      expect(runCommand('yarn affected:apps')).toContain(myapp2);
      runCommand(`git add . && git commit -am "add ${myapp2}"`);

      runCLI(`generate @nrwl/angular:lib ${mylib}`);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).toContain(mylib);
      runCommand(`git add . && git commit -am "add ${mylib}"`);
    }, 1000000);

    it('should detect changes to projects based on the nx.json', () => {
      const nxJson: NxJson = readJson('nx.json');

      nxJson.projects[myapp].tags = ['tag'];
      updateFile('nx.json', JSON.stringify(nxJson));
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "add tag to ${myapp}"`);
    });

    it('should detect changes to projects based on the workspace.json', () => {
      const workspaceJson = readJson(workspaceConfigName());

      workspaceJson.projects[myapp].prefix = 'my-app';
      updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "change prefix for ${myapp}"`);
    });

    it('should affect all projects by removing projects', () => {
      const workspaceJson = readJson(workspaceConfigName());
      delete workspaceJson.projects[mylib];
      updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));

      const nxJson = readJson('nx.json');
      delete nxJson.projects[mylib];
      updateFile('nx.json', JSON.stringify(nxJson));

      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "remove ${mylib}"`);
    });
  });

  describe('print-affected', () => {
    it('should print information about affected projects', () => {
      newProject();
      const myapp = uniq('myapp-a');
      const myapp2 = uniq('myapp-b');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');

      runCLI(`generate @nrwl/react:app ${myapp}`);
      runCLI(`generate @nrwl/react:app ${myapp2}`);
      runCLI(`generate @nrwl/react:lib ${mylib}`);
      runCLI(`generate @nrwl/react:lib ${mylib2}`);
      runCLI(`generate @nrwl/react:lib ${mypublishablelib} --publishable`);

      updateFile(
        `apps/${myapp}/src/main.tsx`,
        `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@proj/${mylib}";
          import "@proj/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));

          `
      );

      updateFile(
        `apps/${myapp2}/src/main.tsx`,
        `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@proj/${mylib}";
          import "@proj/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));
          `
      );

      const resWithoutTarget = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx`
        )
      );
      expect(resWithoutTarget.tasks).toEqual([]);
      compareTwoArrays(resWithoutTarget.projects, [`${myapp}-e2e`, myapp]);

      const resWithTarget = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test`
        ).trim()
      );

      expect(resWithTarget.tasks).toEqual([
        {
          id: `${myapp}:test`,
          overrides: {},
          target: {
            project: myapp,
            target: 'test',
          },
          command: `npm run ${cliCommand} -- test ${myapp}`,
          outputs: [],
        },
      ]);
      compareTwoArrays(resWithTarget.projects, [`${myapp}-e2e`, myapp]);

      const resWithDeps = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=build --with-deps`
        )
      );
      expect(resWithDeps.tasks).toEqual([
        {
          id: `${mypublishablelib}:build`,
          overrides: {},
          target: {
            project: mypublishablelib,
            target: 'build',
          },
          command: `npm run ${cliCommand} -- build ${mypublishablelib}`,
          outputs: [`dist/libs/${mypublishablelib}`],
        },
        {
          id: `${myapp}:build`,
          overrides: {},
          target: {
            project: myapp,
            target: 'build',
          },
          command: `npm run ${cliCommand} -- build ${myapp}`,
          outputs: [`dist/apps/${myapp}`],
        },
      ]);
      compareTwoArrays(resWithDeps.projects, [
        mylib,
        mypublishablelib,
        myapp,
        `${myapp}-e2e`,
      ]);

      const resWithTargetWithSelect1 = runCommand(
        `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test --select=projects`
      ).trim();
      compareTwoSerializedArrays(
        resWithTargetWithSelect1,
        `${myapp}-e2e, ${myapp}`
      );

      const resWithTargetWithSelect2 = runCommand(
        `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test --select="tasks.target.project"`
      ).trim();
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
    it('should cache command execution', async () => {
      ensureProject();

      const myapp1 = uniq('myapp1');
      const myapp2 = uniq('myapp2');
      runCLI(`generate @nrwl/web:app ${myapp1}`);
      runCLI(`generate @nrwl/web:app ${myapp2}`);
      const files = `--files="apps/${myapp1}/src/main.ts,apps/${myapp2}/src/main.ts"`;

      // run build with caching
      // --------------------------------------------
      const outputThatPutsDataIntoCache = runCommand(
        `npm run affected:build -- ${files}`
      );
      const filesApp1 = listFiles(`dist/apps/${myapp1}`);
      const filesApp2 = listFiles(`dist/apps/${myapp2}`);
      // now the data is in cache
      expect(outputThatPutsDataIntoCache).not.toContain(
        'read the output from cache'
      );

      rmDist();

      const outputWithBothBuildTasksCached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithBothBuildTasksCached).toContain(
        'read the output from cache'
      );
      expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
      expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
      expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

      // run with skipping cache
      const outputWithBothBuildTasksCachedButSkipped = runCommand(
        `npm run affected:build -- ${files} --skip-nx-cache`
      );
      expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
        `read the output from cache`
      );

      // touch myapp1
      // --------------------------------------------
      updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
        return `${c}\n//some comment`;
      });
      const outputWithBuildApp2Cached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithBuildApp2Cached).toContain('read the output from cache');
      expectCached(outputWithBuildApp2Cached, [myapp2]);

      // touch package.json
      // --------------------------------------------
      updateFile(`package.json`, (c) => {
        const r = JSON.parse(c);
        r.description = 'different';
        return JSON.stringify(r);
      });
      const outputWithNoBuildCached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithNoBuildCached).not.toContain(
        'read the output from cache'
      );

      // build individual project with caching
      const individualBuildWithCache = runCommand(
        `npm run nx -- build ${myapp1}`
      );
      expect(individualBuildWithCache).toContain('Cached Output');

      // skip caching when building individual projects
      const individualBuildWithSkippedCache = runCommand(
        `npm run nx -- build ${myapp1} --skip-nx-cache`
      );
      expect(individualBuildWithSkippedCache).not.toContain('Cached Output');

      // run lint with caching
      // --------------------------------------------
      const outputWithNoLintCached = runCommand(
        `npm run affected:lint -- ${files}`
      );
      expect(outputWithNoLintCached).not.toContain(
        'read the output from cache'
      );

      const outputWithBothLintTasksCached = runCommand(
        `npm run affected:lint -- ${files}`
      );
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

      const outputWithoutCachingEnabled1 = runCommand(
        `npm run affected:build -- ${files}`
      );

      expect(outputWithoutCachingEnabled1).not.toContain(
        'read the output from cache'
      );

      const outputWithoutCachingEnabled2 = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithoutCachingEnabled2).not.toContain(
        'read the output from cache'
      );
    }, 120000);

    function expectCached(
      actualOutput: string,
      expectedCachedProjects: string[]
    ) {
      const cachedProjects = [];
      const lines = actualOutput.split('\n');
      lines.forEach((s, i) => {
        if (s.startsWith(`> ${cliCommand} run`)) {
          const projectName = s
            .split(`> ${cliCommand} run `)[1]
            .split(':')[0]
            .trim();
          if (lines[i + 2].indexOf('Cached Output') > -1) {
            cachedProjects.push(projectName);
          }
        }
      });

      cachedProjects.sort((a, b) => a.localeCompare(b));
      expectedCachedProjects.sort((a, b) => a.localeCompare(b));
      expect(cachedProjects).toEqual(expectedCachedProjects);
    }
  });
});

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
    expect(runCommand(`cd apps/${myapp}-e2e/src && npx nx lint`)).toContain(
      `nx run ${myapp}-e2e:lint`
    );
  }, 10000);

  it('should error for invalid configurations', () => {
    const myapp = uniq('app');
    runCLI(`generate @nrwl/react:app ${myapp}`);
    // configuration has to be valid for the initiating project
    expect(() => runCLI(`build ${myapp} -c=invalid`)).toThrow();
  }, 10000);

  describe('--with-deps', () => {
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

    it('should include deps', () => {
      const output = runCLI(`test ${myapp} --with-deps`);
      expect(output).toContain(
        `NX   Running target test for project ${myapp} and 2 task(s) it depends on`
      );
      expect(output).toContain(myapp);
      expect(output).toContain(mylib1);
      expect(output).toContain(mylib2);
    }, 10000);

    it('should include deps without the configuration if it does not exist', () => {
      const buildWithDeps = runCLI(`build ${myapp} --with-deps --prod`);
      expect(buildWithDeps).toContain('Successfully ran target build');
      expect(buildWithDeps).toContain(`nx run ${myapp}:build:production`);
      expect(buildWithDeps).toContain(`nx run ${mylib1}:build`);
      expect(buildWithDeps).toContain(`nx run ${mylib2}:build`);
      expect(buildWithDeps).not.toContain(`nx run ${mylib1}:build:production`);
      expect(buildWithDeps).not.toContain(`nx run ${mylib2}:build:production`);
    }, 10000);
  });

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
        config.targets.build.dependsOn = [
          {
            target: 'build',
            projects: 'dependencies',
          },
        ];
        return config;
      });

      const output = runCLI(`build ${myapp}`);
      expect(output).toContain(
        `NX   Running target build for project ${myapp} and 2 task(s) it depends on`
      );
      expect(output).toContain(myapp);
      expect(output).toContain(mylib1);
      expect(output).toContain(mylib2);

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

describe('run-many', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));
  afterEach(() => {
    cleanupProject();
  });

  it('should build specific and all projects', () => {
    const appA = uniq('appa-rand');
    const libA = uniq('liba-rand');
    const libB = uniq('libb-rand');
    const libC = uniq('libc-rand');
    const libD = uniq('libd-rand');

    runCLI(`generate @nrwl/react:app ${appA}`);
    runCLI(`generate @nrwl/react:lib ${libA} --buildable --defaults`);
    runCLI(`generate @nrwl/react:lib ${libB} --buildable --defaults`);
    runCLI(`generate @nrwl/react:lib ${libC} --buildable --defaults`);
    runCLI(`generate @nrwl/react:lib ${libD} --defaults`);

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

    // testing run many --with-deps
    const buildWithDeps = runCLI(
      `run-many --target=build --projects="${libA}" --with-deps`
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
    runCommand(
      `git add . && git commit -am "initial commit" && git checkout -b main`
    );
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

describe('print-affected', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));
  afterEach(() => cleanupProject());

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
      id: `${myapp}:build:production`,
      overrides: {},
      target: {
        project: myapp,
        target: 'build',
      },
      command: `${runNx} run ${myapp}:build:production`,
      outputs: [`dist/apps/${myapp}`],
    });

    expect(resWithDeps.tasks[1]).toMatchObject({
      id: `${mypublishablelib}:build`,
      overrides: {},
      target: {
        project: mypublishablelib,
        target: 'build',
      },
      command: `${runNx} run ${mypublishablelib}:build`,
      outputs: [`dist/libs/${mypublishablelib}`],
    });

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

  afterEach(() => cleanupProject());

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
      'read the output from the cache'
    );

    rmDist();

    const outputWithBothBuildTasksCached = runCLI(`affected:build ${files}`);
    expect(outputWithBothBuildTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
    expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
    expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

    // run with skipping cache
    const outputWithBothBuildTasksCachedButSkipped = runCLI(
      `affected:build ${files} --skip-nx-cache`
    );
    expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
      `read the output from the cache`
    );

    // touch myapp1
    // --------------------------------------------
    updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
      return `${c}\n//some comment`;
    });
    const outputWithBuildApp2Cached = runCLI(`affected:build ${files}`);
    expect(outputWithBuildApp2Cached).toContain(
      'read the output from the cache'
    );
    expectMatchedOutput(outputWithBuildApp2Cached, [myapp2]);

    // touch package.json
    // --------------------------------------------
    updateFile(`package.json`, (c) => {
      const r = JSON.parse(c);
      r.description = 'different';
      return JSON.stringify(r);
    });
    const outputWithNoBuildCached = runCLI(`affected:build ${files}`);
    expect(outputWithNoBuildCached).not.toContain(
      'read the output from the cache'
    );

    // build individual project with caching
    const individualBuildWithCache = runCLI(`build ${myapp1}`);
    expect(individualBuildWithCache).toContain(
      'existing outputs match the cache'
    );

    // skip caching when building individual projects
    const individualBuildWithSkippedCache = runCLI(
      `build ${myapp1} --skip-nx-cache`
    );
    expect(individualBuildWithSkippedCache).not.toContain(
      'existing outputs match the cache'
    );

    // run lint with caching
    // --------------------------------------------
    const outputWithNoLintCached = runCLI(`affected:lint ${files}`);
    expect(outputWithNoLintCached).not.toContain(
      'read the output from the cache'
    );

    const outputWithBothLintTasksCached = runCLI(`affected:lint ${files}`);
    expect(outputWithBothLintTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothLintTasksCached, [
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ]);

    // cache task failures
    // --------------------------------------------
    // updateFile('workspace.json', (c) => {
    //   const workspaceJson = JSON.parse(c);
    //   workspaceJson.projects[myapp1].targets.lint = {
    //     executor: '@nrwl/workspace:run-commands',
    //     options: {
    //       command: 'echo hi && exit 1',
    //     },
    //   };
    //   return JSON.stringify(workspaceJson, null, 2);
    // });
    // const failingRun = runCLI(`lint ${myapp1}`, {
    //   silenceError: true,
    //   env: { ...process.env, NX_CACHE_FAILURES: 'true' },
    // });
    // expect(failingRun).not.toContain('[retrieved from cache]');
    //
    // const cachedFailingRun = runCLI(`lint ${myapp1}`, {
    //   silenceError: true,
    //   env: { ...process.env, NX_CACHE_FAILURES: 'true' },
    // });
    // expect(cachedFailingRun).toContain('[retrieved from cache]');

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
      'read the output from the cache'
    );

    const outputWithoutCachingEnabled2 = runCLI(`affected:build ${files}`);
    expect(outputWithoutCachingEnabled2).not.toContain(
      'read the output from the cache'
    );
  }, 120000);

  it('should only cache specific files if build outputs is configured with specific files', async () => {
    const mylib1 = uniq('mylib1');
    runCLI(`generate @nrwl/react:lib ${mylib1} --buildable`);

    // Update outputs in workspace.json to just be a particular file
    updateProjectConfig(mylib1, (config) => {
      config.targets['build-base'] = {
        ...config.targets.build,
      };
      config.targets.build = {
        executor: '@nrwl/workspace:run-commands',
        outputs: [`dist/libs/${mylib1}/index.esm.js`],
        options: {
          commands: [
            {
              command: `npx nx run ${mylib1}:build-base`,
            },
          ],
          parallel: false,
        },
      };
      return config;
    });

    // run build with caching
    // --------------------------------------------
    const outputThatPutsDataIntoCache = runCLI(`run ${mylib1}:build`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain('cache');

    rmDist();

    const outputWithBuildTasksCached = runCLI(`run ${mylib1}:build`);
    expect(outputWithBuildTasksCached).toContain('cache');
    expectCached(outputWithBuildTasksCached, [mylib1]);
    // Ensure that only the specific file in outputs was copied to cache
    expect(listFiles(`dist/libs/${mylib1}`)).toEqual([`index.esm.js`]);
  }, 120000);

  function expectCached(
    actualOutput: string,
    expectedCachedProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(actualOutput, expectedCachedProjects);
  }

  function expectMatchedOutput(
    actualOutput: string,
    expectedMatchedOutputProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(
      actualOutput,
      expectedMatchedOutputProjects,
      'existing outputs match the cache'
    );
  }

  function expectProjectMatchTaskCacheStatus(
    actualOutput: string,
    expectedProjects: string[],
    cacheStatus: string = 'local cache'
  ) {
    const matchingProjects = [];
    const lines = actualOutput.split('\n');
    lines.forEach((s) => {
      if (s.trimStart().startsWith(`> nx run`)) {
        const projectName = s
          .trimStart()
          .split(`> nx run `)[1]
          .split(':')[0]
          .trim();
        if (s.indexOf(cacheStatus) > -1) {
          matchingProjects.push(projectName);
        }
      }
    });

    matchingProjects.sort((a, b) => a.localeCompare(b));
    expectedProjects.sort((a, b) => a.localeCompare(b));
    expect(matchingProjects).toEqual(expectedProjects);
  }
});

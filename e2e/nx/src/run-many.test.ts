import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { setupRunTests } from './run-setup';

describe('run-many', () => {
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

  it('should build specific and all projects', () => {
    // This is required to ensure the numbers used in the assertions make sense for this test
    const proj = newProject();
    const appA = uniq('appa-rand');
    const libA = uniq('liba-rand');
    const libB = uniq('libb-rand');
    const libC = uniq('libc-rand');
    const libD = uniq('libd-rand');

    runCLI(`generate @nx/web:app ${appA} --directory=apps/${appA}`);
    runCLI(
      `generate @nx/js:lib ${libA} --bundler=tsc --defaults --directory=libs/${libA}`
    );
    runCLI(
      `generate @nx/js:lib ${libB} --bundler=tsc --defaults --tags=ui-a --directory=libs/${libB}`
    );
    runCLI(
      `generate @nx/js:lib ${libC} --bundler=tsc --defaults --tags=ui-b,shared --directory=libs/${libC}`
    );
    runCLI(
      `generate @nx/node:lib ${libD} --defaults --tags=api --directory=libs/${libD} --buildable=false`
    );

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
    expect(buildAllParallel).toContain(`Running target build for 4 projects:`);
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
    expect(buildWithExcludeParallel).toContain('Successfully ran target build');

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
    runCLI(
      `generate @nx/web:app ${myapp1} --directory=apps/${myapp1} --unitTestRunner=vitest`
    );
    runCLI(
      `generate @nx/web:app ${myapp2} --directory=apps/${myapp2} --unitTestRunner=vitest`
    );

    let outputs = runCLI(
      // Options with lists can be specified using multiple args or with a delimiter (comma or space).
      `run-many -t build -t test -p ${myapp1} ${myapp2}`
    );
    expect(outputs).toContain('Running targets build, test for 2 projects:');

    outputs = runCLI(`run-many -t build test -p=${myapp1},${myapp2}`);
    expect(outputs).toContain('Running targets build, test for 2 projects:');
  });
});

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

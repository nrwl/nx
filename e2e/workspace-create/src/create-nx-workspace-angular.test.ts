import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  getSelectedPackageManager,
  readJson,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=angular', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';
  let strictDepBuilds: string | undefined;

  beforeAll(() => {
    // The harness turns pnpm's build-script check off for every e2e, so a
    // generator that misses a decision would not fail the creation.
    strictDepBuilds = process.env.pnpm_config_strict_dep_builds;
    process.env.pnpm_config_strict_dep_builds = 'true';
  });

  afterAll(() => {
    if (strictDepBuilds === undefined) {
      delete process.env.pnpm_config_strict_dep_builds;
    } else {
      process.env.pnpm_config_strict_dep_builds = strictDepBuilds;
    }
  });

  afterEach(() => cleanupProject());

  it('should create a workspace with a single angular app at the root without routing', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: false,
      routing: false,
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app-module.ts');
    checkFilesDoNotExist('src/app/app.routes.ts');
    expectCodeIsFormatted();

    const nxJson = readJson(`nx.json`);
    expect(nxJson.nxCloudId).toBeUndefined();
  });

  it('should create a workspace with a single angular app at the root using standalone APIs', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: true,
      routing: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app.routes.ts');
    checkFilesDoNotExist('src/app/app-module.ts');
    expectCodeIsFormatted();
  });

  it('should be able to create an angular workspace', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-monorepo',
      style: 'css',
      appName,
      packageManager,
      standaloneApi: false,
      routing: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });
    expectCodeIsFormatted();
  });

  it('should be able to create an angular workspace using rspack', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-monorepo',
      style: 'css',
      appName,
      packageManager,
      standaloneApi: false,
      routing: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      bundler: 'rspack',
      ssr: false,
    });
    expectCodeIsFormatted();
  });

  it('should be able to create an angular workspace using esbuild', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-monorepo',
      style: 'css',
      appName,
      packageManager,
      standaloneApi: false,
      routing: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      bundler: 'esbuild',
      ssr: false,
    });
    expectCodeIsFormatted();
  });

  it('should fail correctly when preset errors', () => {
    // Using Angular Preset as the example here to test
    // It will error when prefix is not valid
    const wsName = uniq('angular-1-test');
    const appName = uniq('app');
    expect(() =>
      runCreateWorkspace(wsName, {
        preset: 'angular-monorepo',
        style: 'css',
        appName,
        packageManager,
        standaloneApi: false,
        routing: false,
        e2eTestRunner: 'none',
        bundler: 'webpack',
        ssr: false,
        prefix: '1-one',
      })
    ).toThrow();
  });
});

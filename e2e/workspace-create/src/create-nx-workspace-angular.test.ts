import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  getSelectedPackageManager,
  readJson,
  runCLIAsync,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=angular', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  (packageManager === 'pnpm' ? it : it.skip)(
    'should create and build an Angular app with strict pnpm build approvals',
    async () => {
      const strictDepBuilds = process.env.pnpm_config_strict_dep_builds;
      const codexThreadId = process.env.CODEX_THREAD_ID;
      try {
        // Keep the real preset flow and pnpm 11's default strict behavior,
        // even when the surrounding e2e environment relaxes build approvals.
        process.env.pnpm_config_strict_dep_builds = 'true';
        delete process.env.CODEX_THREAD_ID;
        runCreateWorkspace(uniq('angular-pnpm'), {
          preset: 'angular-monorepo',
          appName: 'sample-app',
          style: 'css',
          packageManager: 'pnpm',
          formatter: 'prettier',
          e2eTestRunner: 'playwright',
          ssr: false,
          extraArgs: '--bundler=esbuild --zoneless=true',
        });

        await runCLIAsync('build sample-app');
        await runCLIAsync('test sample-app');
      } finally {
        if (strictDepBuilds === undefined) {
          delete process.env.pnpm_config_strict_dep_builds;
        } else {
          process.env.pnpm_config_strict_dep_builds = strictDepBuilds;
        }
        if (codexThreadId !== undefined) {
          process.env.CODEX_THREAD_ID = codexThreadId;
        }
      }
    }
  );

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

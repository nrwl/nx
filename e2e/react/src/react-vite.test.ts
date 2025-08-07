import {
  checkFilesExist,
  cleanupProject,
  getAvailablePort,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';

describe('Build React applications and libraries with Vite', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react'],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should test and lint app with bundler=vite and compiler=babel', async () => {
    const viteApp = uniq('viteapp');

    runCLI(
      `generate @nx/react:app apps/${viteApp} --bundler=vite --compiler=babel --unitTestRunner=vitest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${viteApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${viteApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${viteApp}`);
    checkFilesExist(`dist/apps/${viteApp}/index.html`);
  }, 300_000);

  it('should test and lint app with bundler=vite and compiler=swc', async () => {
    const viteApp = uniq('viteapp');

    runCLI(
      `generate @nx/react:app apps/${viteApp} --bundler=vite --compiler=swc --unitTestRunner=vitest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${viteApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${viteApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${viteApp}`);
    checkFilesExist(`dist/apps/${viteApp}/index.html`);
  }, 300_000);

  it('should generate app with custom port', async () => {
    const viteApp = uniq('viteapp');
    const customPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:app apps/${viteApp} --bundler=vite --port=${customPort} --unitTestRunner=vitest --no-interactive --linter=eslint --e2eTestRunner=playwright`
    );

    const viteConfig = readFile(`apps/${viteApp}/vite.config.ts`);
    expect(viteConfig).toContain(`port: ${customPort}`);

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${viteApp}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts()).toBeTruthy();
    }
  }, 300_000);

  it('should test and lint app with bundler=vite and inSourceTests', async () => {
    const viteApp = uniq('viteapp');
    const viteLib = uniq('vitelib');

    runCLI(
      `generate @nx/react:app apps/${viteApp} --bundler=vite --unitTestRunner=vitest --inSourceTests --no-interactive --linter=eslint`
    );
    expect(() => {
      checkFilesExist(`apps/${viteApp}/src/app/app.spec.tsx`);
    }).toThrow();

    const appTestResults = await runCLIAsync(`test ${viteApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${viteApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${viteApp}`);
    checkFilesExist(`dist/apps/${viteApp}/index.html`);

    runCLI(
      `generate @nx/react:lib libs/${viteLib} --bundler=vite --inSourceTests --unitTestRunner=vitest --no-interactive --linter=eslint`
    );
    expect(() => {
      checkFilesExist(`libs/${viteLib}/src/lib/${viteLib}.spec.tsx`);
    }).toThrow();

    runCLI(
      `generate @nx/react:component libs/${viteLib}/src/lib/comp1/comp1 --inSourceTests --export --no-interactive`
    );
    expect(() => {
      checkFilesExist(`libs/${viteLib}/src/lib/comp1/comp1.spec.tsx`);
    }).toThrow();

    runCLI(
      `generate @nx/react:component libs/${viteLib}/src/lib/comp2/comp2 --export --no-interactive`
    );
    checkFilesExist(`libs/${viteLib}/src/lib/comp2/comp2.spec.tsx`);

    const libTestResults = await runCLIAsync(`test ${viteLib}`);
    expect(libTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const libLintResults = await runCLIAsync(`lint ${viteLib}`);
    expect(libLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${viteLib}`);
    checkFilesExist(
      `dist/libs/${viteLib}/index.d.ts`,
      `dist/libs/${viteLib}/index.mjs`
    );
  }, 300_000);

  it('should support bundling with Vite', async () => {
    const viteLib = uniq('vitelib');

    runCLI(
      `generate @nx/react:lib libs/${viteLib} --bundler=vite --no-interactive --unit-test-runner=none --linter=eslint`
    );

    await runCLIAsync(`build ${viteLib}`);

    checkFilesExist(
      `dist/libs/${viteLib}/index.d.ts`,
      `dist/libs/${viteLib}/index.mjs`
    );

    // Convert non-buildable lib to buildable one
    const nonBuildableLib = uniq('nonbuildablelib');
    runCLI(
      `generate @nx/react:lib libs/${nonBuildableLib} --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    runCLI(
      `generate @nx/vite:configuration ${nonBuildableLib} --uiFramework=react --no-interactive`
    );
    await runCLIAsync(`build ${nonBuildableLib}`);
    checkFilesExist(
      `dist/libs/${nonBuildableLib}/index.d.ts`,
      `dist/libs/${nonBuildableLib}/index.mjs`,
      `dist/libs/${nonBuildableLib}/README.md`
    );
  }, 300_000);

  it('should support bundling with Vite and Jest', async () => {
    const viteApp = uniq('viteapp');

    runCLI(
      `generate @nx/react:app apps/${viteApp} --bundler=vite --unitTestRunner=jest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${viteApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    await runCLIAsync(`build ${viteApp}`);
    checkFilesExist(`dist/apps/${viteApp}/index.html`);
  }, 300_000);
});

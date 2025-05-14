import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('Build React applications and libraries with Rsbuild', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react'],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should test and lint app with bundler=rsbuild', async () => {
    const rsbuildApp = uniq('rsbuildapp');

    runCLI(
      `generate @nx/react:app apps/${rsbuildApp} --bundler=rsbuild --unitTestRunner=vitest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${rsbuildApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${rsbuildApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${rsbuildApp}`);
    checkFilesExist(`apps/${rsbuildApp}/dist/index.html`);
  }, 300_000);

  it('should test and lint app with bundler=rsbuild', async () => {
    const rsbuildApp = uniq('rsbuildapp');

    runCLI(
      `generate @nx/react:app apps/${rsbuildApp} --bundler=rsbuild --unitTestRunner=vitest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${rsbuildApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${rsbuildApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${rsbuildApp}`);
    checkFilesExist(`apps/${rsbuildApp}/dist/index.html`);
  }, 300_000);

  it('should test and lint app with bundler=rsbuild and inSourceTests', async () => {
    const rsbuildApp = uniq('rsbuildapp');

    runCLI(
      `generate @nx/react:app apps/${rsbuildApp} --bundler=rsbuild --unitTestRunner=vitest --inSourceTests --no-interactive --linter=eslint`
    );
    expect(() => {
      checkFilesExist(`apps/${rsbuildApp}/src/app/app.spec.tsx`);
    }).toThrow();

    const appTestResults = await runCLIAsync(`test ${rsbuildApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    const appLintResults = await runCLIAsync(`lint ${rsbuildApp}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    await runCLIAsync(`build ${rsbuildApp}`);
    checkFilesExist(`apps/${rsbuildApp}/dist/index.html`);
  }, 300_000);

  it('should support bundling with Rsbuild and Jest', async () => {
    const rsbuildApp = uniq('rsbuildapp');

    runCLI(
      `generate @nx/react:app apps/${rsbuildApp} --bundler=rsbuild --unitTestRunner=jest --no-interactive --linter=eslint`
    );

    const appTestResults = await runCLIAsync(`test ${rsbuildApp}`);
    expect(appTestResults.combinedOutput).toContain(
      'Successfully ran target test'
    );

    await runCLIAsync(`build ${rsbuildApp}`);
    checkFilesExist(`apps/${rsbuildApp}/dist/index.html`);

    if (runE2ETests()) {
      const result = runCLI(`e2e ${rsbuildApp}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${rsbuildApp}-e2e`
      );
    }
  }, 300_000);
});

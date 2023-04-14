import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nrwl/e2e/utils';

describe('Build React applications and libraries with Vite', () => {
  let proj: string;

  beforeEach(() => {
    proj = newProject();
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should test and lint app with bundler=vite', async () => {
    const viteApp = uniq('viteapp');

    runCLI(
      `generate @nrwl/react:app ${viteApp} --bundler=vite --unitTestRunner=vitest --no-interactive`
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

  it('should test and lint app with bundler=vite and inSourceTests', async () => {
    const viteApp = uniq('viteapp');
    const viteLib = uniq('vitelib');

    runCLI(
      `generate @nrwl/react:app ${viteApp} --bundler=vite --unitTestRunner=vitest --inSourceTests --no-interactive`
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
      `generate @nrwl/react:lib ${viteLib} --bundler=vite --inSourceTests --unitTestRunner=vitest --no-interactive`
    );
    expect(() => {
      checkFilesExist(`libs/${viteLib}/src/lib/${viteLib}.spec.tsx`);
    }).toThrow();

    runCLI(
      `generate @nrwl/react:component comp1 --inSourceTests --export --project=${viteLib} --no-interactive`
    );
    expect(() => {
      checkFilesExist(`libs/${viteLib}/src/lib/comp1/comp1.spec.tsx`);
    }).toThrow();

    runCLI(
      `generate @nrwl/react:component comp2 --export --project=${viteLib} --no-interactive`
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
      `dist/libs/${viteLib}/index.js`,
      `dist/libs/${viteLib}/index.mjs`
    );
  }, 300_000);

  it('should support bundling with Vite', async () => {
    const viteLib = uniq('vitelib');

    runCLI(
      `generate @nrwl/react:lib ${viteLib} --bundler=vite --no-interactive --unit-test-runner=none`
    );

    const packageJson = readJson('package.json');
    // Vite does not need these libraries to work.
    expect(packageJson.dependencies['core-js']).toBeUndefined();
    expect(packageJson.dependencies['tslib']).toBeUndefined();

    await runCLIAsync(`build ${viteLib}`);

    checkFilesExist(
      `dist/libs/${viteLib}/package.json`,
      `dist/libs/${viteLib}/index.d.ts`,
      `dist/libs/${viteLib}/index.js`,
      `dist/libs/${viteLib}/index.mjs`
    );

    // Convert non-buildable lib to buildable one
    const nonBuildableLib = uniq('nonbuildablelib');
    runCLI(
      `generate @nrwl/react:lib ${nonBuildableLib} --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nrwl/vite:configuration ${nonBuildableLib} --uiFramework=react --no-interactive`
    );
    await runCLIAsync(`build ${nonBuildableLib}`);
    checkFilesExist(
      `dist/libs/${nonBuildableLib}/index.d.ts`,
      `dist/libs/${nonBuildableLib}/index.js`,
      `dist/libs/${nonBuildableLib}/index.mjs`
    );
  }, 300_000);
});

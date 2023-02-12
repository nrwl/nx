import {
  checkFilesExist,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nrwl/e2e/utils';

describe('React Applications: additional packages', () => {
  beforeAll(() => newProject());

  it('should generate app with routing', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/react:app ${appName} --routing --bundler=webpack --no-interactive`
    );

    runCLI(`build ${appName} --outputHashing none`);

    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/main.js`
    );
  }, 250_000);

  it('should be able to add a redux slice', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`g @nrwl/react:app ${appName} --bundler=webpack --no-interactive`);
    runCLI(`g @nrwl/react:redux lemon --project=${appName}`);
    runCLI(
      `g @nrwl/react:lib ${libName} --unit-test-runner=jest --no-interactive`
    );
    runCLI(`g @nrwl/react:redux orange --project=${libName}`);

    const appTestResults = await runCLIAsync(`test ${appName}`);
    expect(appTestResults.combinedOutput).toContain(
      'Test Suites: 2 passed, 2 total'
    );

    const libTestResults = await runCLIAsync(`test ${libName}`);
    expect(libTestResults.combinedOutput).toContain(
      'Test Suites: 2 passed, 2 total'
    );
  }, 250_000);
});

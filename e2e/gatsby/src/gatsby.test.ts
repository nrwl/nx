import {
  checkFilesExist,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Gatsby Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should generate a valid gatsby application', async () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/gatsby:app ${appName}`);
    runCLI(`generate @nrwl/gatsby:component header --project ${appName}`);

    checkFilesExist(
      `apps/${appName}/package.json`,
      `apps/${appName}/src/components/header.tsx`,
      `apps/${appName}/src/components/header.spec.tsx`,
      `apps/${appName}/src/pages/index.tsx`,
      `apps/${appName}/src/pages/index.spec.tsx`
    );

    updateFile(`apps/${appName}/src/pages/index.tsx`, (content) => {
      let updated = `import Header from '../components/header';\n${content}`;
      updated = updated.replace('<main>', '<Header /><main>');
      return updated;
    });

    let result = runCLI(`build ${appName}`);
    expect(result).toContain('Done building in');

    result = runCLI(`lint ${appName}`);
    expect(result).not.toMatch('Lint errors found in the listed files');

    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 2 passed, 2 total'
    );
  }, 600000);

  it('should support styled-jsx', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/gatsby:app ${appName} --style styled-jsx`);

    let result = runCLI(`build ${appName}`);
    expect(result).toContain('Done building in');

    result = runCLI(`lint ${appName}`);
    expect(result).not.toMatch('Lint errors found in the listed files');

    await expect(runCLIAsync(`test ${appName}`)).resolves.toBeTruthy();
  }, 300000);

  it('should support scss', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/gatsby:app ${appName} --style scss`);

    let result = runCLI(`build ${appName}`);
    expect(result).toContain('Done building in');

    result = runCLI(`lint ${appName}`);
    expect(result).not.toMatch('Lint errors found in the listed files');

    await expect(runCLIAsync(`test ${appName}`)).resolves.toBeTruthy();
  }, 300000);

  it('should support --js option', async () => {
    const app = uniq('app');
    runCLI(`generate @nrwl/gatsby:app ${app} --js`);

    checkFilesExist(
      `apps/${app}/package.json`,
      `apps/${app}/src/pages/index.js`,
      `apps/${app}/src/pages/index.spec.js`
    );

    const result = runCLI(`build ${app}`);
    expect(result).toContain('Done building in');
  }, 300000);
});

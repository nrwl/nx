import {
  checkFilesExist,
  expectTestsPass,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('expo', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should test, lint', async () => {
    const appName = uniq('my-app');
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(`generate @nrwl/expo:application ${appName}`);
    runCLI(`generate @nrwl/expo:library ${libName}`);
    runCLI(
      `generate @nrwl/expo:component ${componentName} --project=${libName} --export`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport ${componentName} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expectTestsPass(await runCLIAsync(`test ${appName}`));
    expectTestsPass(await runCLIAsync(`test ${libName}`));

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain('All files pass linting.');

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting.');
  }, 1000000);
});

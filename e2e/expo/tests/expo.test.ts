import {
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Expo', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should create files and run lint command', async () => {
    const appName = uniq('my-app');
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(`generate @nrwl/expo:application ${appName}`);
    runCLI(`generate @nrwl/expo:library ${libName}`);
    runCLI(
      `generate @nrwl/expo:component ${componentName} --project=${libName} --export`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `import ${componentName} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    // testing does not work due to issue https://github.com/callstack/react-native-testing-library/issues/743
    // react-native 0.64.3 is using @jest/create-cache-key-function 26.5.0 that is incompatible with jest 27.
    // expectTestsPass(await runCLIAsync(`test ${appName}`));
    // expectTestsPass(await runCLIAsync(`test ${libName}`));

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain('All files pass linting.');
    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting.');
  });
});

import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  cleanupProject,
  expectJestTestsToPass,
  getStrippedEnvironmentVariables,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('Jest', () => {
  beforeAll(() => {
    newProject({ name: uniq('proj-jest'), packages: ['@nx/js', '@nx/node'] });
  });

  afterAll(() => cleanupProject());

  it('should be able to test node lib with babel-jest', async () => {
    const libName = uniq('babel-test-lib');
    runCLI(
      `generate @nx/node:lib libs/${libName} --buildable --importPath=@some-org/babel-test --publishable --babelJest --unitTestRunner=jest`
    );

    const cliResults = await runCLIAsync(`test ${libName}`);
    expect(cliResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 90000);

  it('should be able to run e2e tests split by tasks', async () => {
    const libName = uniq('lib');
    runCLI(`generate @nx/js:lib libs/${libName} --unitTestRunner=jest`);
    updateJson('nx.json', (json) => {
      const jestPlugin = json.plugins.find(
        (plugin) => plugin.plugin === '@nx/jest/plugin'
      );

      jestPlugin.options.ciTargetName = 'e2e-ci';
      return json;
    });

    await runCLIAsync(`e2e-ci ${libName}`, {
      env: {
        ...getStrippedEnvironmentVariables(),
        NX_SKIP_ATOMIZER_VALIDATION: 'true',
      },
    });
  }, 90000);
});

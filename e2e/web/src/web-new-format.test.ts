import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';
import { setupWebTest } from './web-setup';

describe('Web Components Applications', () => {
  setupWebTest();

  it('should support generating applications with the new name and root format', () => {
    const appName = uniq('app1');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive --unitTestRunner=vitest --linter=eslint`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/main.ts`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );
  }, 500_000);
});

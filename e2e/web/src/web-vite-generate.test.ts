import {
  checkFilesExist,
  isNotWindows,
  killPorts,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';
import { setupWebViteTest } from './web-vite-setup';

describe('Web Components Applications with bundler set as vite', () => {
  setupWebViteTest();

  it('should be able to generate a web app', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=vite --no-interactive --linter=eslint --unitTestRunner=vitest`
    );

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);

    const testResults = await runCLIAsync(`test ${appName}`);

    expect(testResults.combinedOutput).toContain(
      `Successfully ran target test for project ${appName}`
    );

    const lintE2eResults = runCLI(`lint ${appName}-e2e`);

    expect(lintE2eResults).toContain('Successfully ran target lint');

    if (isNotWindows() && runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      await killPorts();
    }
  }, 500000);
});

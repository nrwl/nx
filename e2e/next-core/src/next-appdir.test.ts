import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Next.js App Router', () => {
  let proj: string;

  beforeAll(
    () =>
      (proj = newProject({
        packages: ['@nx/next'],
      }))
  );

  afterAll(() => cleanupProject());

  it('should be able to generate and build app with default App Router', async () => {
    const appName = uniq('app');
    const jsLib = uniq('tslib');

    runCLI(
      `generate @nx/next:app ${appName} --e2eTestRunner=playwright --appDir=true`
    );
    runCLI(`generate @nx/js:lib ${jsLib} --no-interactive`);

    updateFile(
      `apps/${appName}/src/app/page.tsx`,
      `
        import React from 'react';
        import { ${jsLib} } from '@${proj}/${jsLib}';

        export default async function Page() {
          return (
            <p>{${jsLib}()}</p>
          );
        }
      `
    );

    updateFile(
      `apps/${appName}-e2e/src/example.spec.ts`,
      `
      import { test, expect } from '@playwright/test';

      test('has ${jsLib}', async ({ page }) => {
        await page.goto('/');

        // Expect h1 to contain a substring.
        expect(await page.locator('p').innerText()).toContain('${jsLib}');
      });
      `
    );

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');

    if (runE2ETests()) {
      const e2eResults = runCLI(
        `e2e ${appName}-e2e --configuration=production`
      );
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts()).toBeTruthy();
    }
  }, 300_000);
});

import {
  cleanupProject,
  isNotWindows,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { checkApp } from './utils';

describe('Next.js App Router', () => {
  let proj: string;

  beforeAll(
    () =>
      (proj = newProject({
        packages: ['@nx/next'],
      }))
  );

  afterAll(() => cleanupProject());

  // TODO: enable this when tests are passing again
  xit('should be able to generate and build app with default App Router', async () => {
    const appName = uniq('app');
    const jsLib = uniq('tslib');

    runCLI(
      `generate @nx/next:app ${appName} --e2eTestRunner=playwright --appDir=true`
    );
    runCLI(`generate @nx/js:lib ${jsLib} --no-interactive`);

    updateFile(
      `apps/${appName}/app/page.tsx`,
      `
        import React from 'react';
        import { ${jsLib} } from '@${proj}/${jsLib}';

        export default async function Page() {
          return (
            <p>{${jsLib}()}</p>
          );
        };
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

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: true,
      checkE2E: isNotWindows(),
      checkExport: false,
    });
  }, 300_000);
});

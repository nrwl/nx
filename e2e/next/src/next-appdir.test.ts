import {
  cleanupProject,
  isNotWindows,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { getData } from 'ajv/dist/compile/validate';
import { detectPackageManager } from 'nx/src/utils/package-manager';
import { checkApp } from './utils';
import { p } from 'vitest/dist/types-b7007192';

describe('Next.js App Router', () => {
  let proj: string;

  beforeEach(() => {
    proj = newProject();
  });

  afterEach(() => {
    cleanupProject();
  });

  it('should be able to generate and build app with default App Router', async () => {
    const appName = uniq('app');
    const jsLib = uniq('tslib');

    runCLI(`generate @nx/next:app ${appName}`);
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

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: true,
      checkE2E: false,
      checkExport: false,
    });
  }, 300_000);
});

import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { checkApp } from './utils';

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

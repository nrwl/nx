import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';

describe('Next.js new format', () => {
  setupNextSuite();

  it('should support generating projects with the new name and root format', () => {
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/src/app/page.tsx`);
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );

    const appTestResult = runCLI(`test ${appName} --passWithNoTests`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    runCLI(
      `generate @nx/next:lib ${libName} --buildable --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${libName}/src/index.ts`);
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
  }, 600_000);
});

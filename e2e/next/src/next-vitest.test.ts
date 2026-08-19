import {
  cleanupProject,
  createFile,
  newProject,
  runCLIAsync,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Next.js Vitest', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/next', '@nx/vitest', '@nx/eslint', '@nx/playwright'],
    });
  });

  afterAll(() => cleanupProject());

  it('should test an app generated with --unitTestRunner=vitest', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --unitTestRunner=vitest --linter=eslint --no-interactive`
    );

    // Colocated specs under src must be picked up alongside the generated specs/ one.
    createFile(
      `${appName}/src/app/page.spec.tsx`,
      `
      import { render } from '@testing-library/react';
      import Page from './page';

      describe('Page', () => {
        it('should render successfully', () => {
          const { baseElement } = render(<Page />);
          expect(baseElement).toBeTruthy();
        });
      });
      `
    );

    const testResult = await runCLIAsync(`test ${appName}`);
    expect(testResult.combinedOutput).toContain('Successfully ran target test');
    // Both the generated specs/ test and the colocated src/ one must run.
    expect(testResult.combinedOutput).toContain('page.spec');
    expect(testResult.combinedOutput).toContain('index.spec');
  }, 300_000);

  it('should test a lib generated with --unitTestRunner=vitest', async () => {
    const libName = uniq('lib');

    runCLI(
      `generate @nx/next:lib ${libName} --style=css --unitTestRunner=vitest --linter=eslint --no-interactive`
    );

    const testResult = await runCLIAsync(`test ${libName}`);
    expect(testResult.combinedOutput).toContain('Successfully ran target test');
  }, 300_000);
});

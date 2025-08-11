import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Next.js Jest Configuration', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject();
  });

  afterAll(() => cleanupProject());

  it('should generate app with next/jest configuration', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --unitTestRunner=jest --projectNameAndRootFormat=as-provided --linter=eslint`
    );

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

    const testResult = runCLI(`test ${appName}`);
    expect(testResult).not.toContain('outdated JSX transform');
  }, 300_000);

  it('should work with JS projects', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --unitTestRunner=jest --projectNameAndRootFormat=as-provided --linter=eslint --js`
    );

    createFile(
      `${appName}/src/lib/example.spec.js`,
      `
      test('example', () => {
          expect(true).toBeTruthy();
      });
      `
    );

    const testResult = runCLI(`test ${appName}`);
    expect(testResult).not.toContain('outdated JSX transform');
  }, 300_000);
});

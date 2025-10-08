import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';

let proj: string;

describe('@nx/workspace:convert-to-monorepo', () => {
  beforeEach(() => {
    proj = newProject({ packages: ['@nx/react', '@nx/js'] });
  });

  afterEach(() => cleanupProject());

  it('should be convert a standalone vite and playwright react project to a monorepo', async () => {
    const reactApp = uniq('reactapp');
    runCLI(
      `generate @nx/react:app --name=${reactApp} --directory="." --rootProject=true --linter eslint --bundler=vite --unitTestRunner vitest --e2eTestRunner=playwright --no-interactive`
    );

    runCLI('generate @nx/workspace:convert-to-monorepo --no-interactive');

    checkFilesExist(
      `apps/${reactApp}/src/main.tsx`,
      `apps/e2e/playwright.config.ts`
    );

    expect(() => runCLI(`build ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`test ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint e2e`)).not.toThrow();
    if (runE2ETests()) {
      expect(() => runCLI(`e2e e2e`)).not.toThrow();
    }
  });
});

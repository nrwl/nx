import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Next.js - no swc', () => {
  beforeAll(() => newProject({ packages: ['@nx/next', '@nx/cypress'] }));
  afterAll(() => cleanupProject());

  it('should support --no-swc flag', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --no-swc --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/.babelrc`);
  }, 300_000);
});

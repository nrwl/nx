import {
  checkFilesDoNotExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Next.js - dev mode build', () => {
  beforeAll(() => newProject({ packages: ['@nx/next', '@nx/cypress'] }));
  afterAll(() => cleanupProject());

  it('should build in dev mode without errors', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false --linter=eslint --unitTestRunner=jest`
    );

    checkFilesDoNotExist(`${appName}/.next/build-manifest.json`);
    checkFilesDoNotExist(`${appName}/.nx-helpers/with-nx.js`);

    expect(() => {
      runCLI(`build ${appName} --configuration=development`);
    }).not.toThrow();
  }, 300_000);
});



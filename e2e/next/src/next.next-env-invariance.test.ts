import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  checkFilesExist,
} from '@nx/e2e-utils';

describe('Next.js - next-env invariance', () => {
  beforeAll(() => newProject({ packages: ['@nx/next', '@nx/cypress'] }));
  afterAll(() => cleanupProject());

  it('next-env.d.ts should remain the same after a build', async () => {
    const appName = uniq('app');
    const pagesAppName = uniq('pages-app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/next:app ${pagesAppName} --appDir=false --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/next-env.d.ts`);
    checkFilesExist(`${pagesAppName}/next-env.d.ts`);

    const appDirNextEnv = `${appName}/next-env.d.ts`;
    const appDirNextEnvContent = readFile(appDirNextEnv);

    const pagesDirNextEnv = `${pagesAppName}/next-env.d.ts`;
    const pagesDirNextEnvContent = readFile(pagesDirNextEnv);

    runCLI(`build ${appName}`);
    runCLI(`build ${pagesAppName}`);

    const postBuildAppContent = readFile(appDirNextEnv);
    const postBuildPagesContent = readFile(pagesDirNextEnv);

    expect(postBuildAppContent).toEqual(appDirNextEnvContent);
    expect(postBuildPagesContent).toEqual(pagesDirNextEnvContent);
  });
});



import { readFile, runCLI, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';

describe('Next.js next-env', () => {
  setupNextSuite();

  it('next-env.d.ts should remain the same after a build', async () => {
    const appName = uniq('app');
    const pagesAppName = uniq('pages-app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/next:app ${pagesAppName} --appDir=false --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );

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

import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  readFile,
} from '@nx/e2e-utils';
import { checkApp } from './utils';

describe('Next.js Styles', () => {
  let originalEnv: string;

  beforeAll(() => {
    newProject({
      packages: ['@nx/next'],
    });
  });

  afterAll(() => cleanupProject());

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should support different --style options', async () => {
    const lessApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${lessApp} --no-interactive --style=less --appDir=false --src=false --unitTestRunner=jest --linter=eslint`
    );

    await checkApp(lessApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      useWebpack: true,
    });

    const scApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${scApp} --no-interactive --style=styled-components --appDir=false --unitTestRunner=jest --linter=eslint`
    );

    await checkApp(scApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });

    const scAppWithAppRouter = uniq('app');

    runCLI(
      `generate @nx/next:app ${scAppWithAppRouter} --no-interactive --style=styled-components --appDir=true --unitTestRunner=jest --linter=eslint`
    );

    await checkApp(scAppWithAppRouter, {
      checkUnitTest: false, // No unit tests for app router
      checkLint: false,
      checkE2E: false,
    });

    const emotionApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${emotionApp} --no-interactive --style=@emotion/styled --appDir=false --unitTestRunner=jest --linter=eslint`
    );

    await checkApp(emotionApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });
  }, 600_000);
});

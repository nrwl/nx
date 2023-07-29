import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e/utils';
import { checkApp } from './utils';

describe('Next.js apps', () => {
  let originalEnv: string;

  beforeAll(() => {
    newProject();
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
      `generate @nx/next:app ${lessApp} --no-interactive --style=less --appDir=false`
    );

    await checkApp(lessApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const stylusApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${stylusApp} --no-interactive --style=styl --appDir=false`
    );

    await checkApp(stylusApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const scApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${scApp} --no-interactive --style=styled-components --appDir=false`
    );

    await checkApp(scApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const scAppWithAppRouter = uniq('app');

    runCLI(
      `generate @nx/next:app ${scAppWithAppRouter} --no-interactive --style=styled-components --appDir=true`
    );

    await checkApp(scAppWithAppRouter, {
      checkUnitTest: false, // No unit tests for app router
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const emotionApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${emotionApp} --no-interactive --style=@emotion/styled --appDir=false`
    );

    await checkApp(emotionApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });
  }, 600_000);
});

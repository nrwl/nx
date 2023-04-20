import { cleanupProject, newProject, runCLI, uniq } from '@nrwl/e2e/utils';
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

  // TODO (meeroslav): enable when this flaky test is fixed
  xit('should support different --style options', async () => {
    const lessApp = uniq('app');

    runCLI(`generate @nrwl/next:app ${lessApp} --no-interactive --style=less`);

    await checkApp(lessApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const stylusApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${stylusApp} --no-interactive --style=styl`
    );

    await checkApp(stylusApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const scApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${scApp} --no-interactive --style=styled-components`
    );

    await checkApp(scApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const emotionApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${emotionApp} --no-interactive --style=@emotion/styled`
    );

    await checkApp(emotionApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });
  }, 300_000);
});

import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  readFile,
} from '@nx/e2e/utils';
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
      `generate @nx/next:app ${lessApp} --no-interactive --style=less --appDir=false --src=false`
    );

    await checkApp(lessApp, {
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

  describe('tailwind', () => {
    it('should support --style=tailwind (pages router)', async () => {
      const tailwindApp = uniq('app');

      runCLI(
        `generate @nx/next:app ${tailwindApp} --no-interactive --style=tailwind --appDir=false --src=false`
      );

      await checkApp(tailwindApp, {
        checkUnitTest: true,
        checkLint: false,
        checkE2E: false,
        checkExport: false,
      });

      checkFilesExist(`apps/${tailwindApp}/tailwind.config.js`);
      checkFilesExist(`apps/${tailwindApp}/postcss.config.js`);

      checkFilesDoNotExist(`apps/${tailwindApp}/pages/index.module.css`);
      const appPage = readFile(`apps/${tailwindApp}/pages/index.tsx`);
      const globalCss = readFile(`apps/${tailwindApp}/pages/styles.css`);

      expect(appPage).not.toContain(`import styles from './index.module.css';`);
      expect(globalCss).toContain(`@tailwind base;`);
    }, 500_000);

    it('should support --style=tailwind (app router)', async () => {
      const tailwindApp = uniq('app');

      runCLI(
        `generate @nx/next:app ${tailwindApp} --no-interactive --style=tailwind --appDir=true --src=false`
      );

      await checkApp(tailwindApp, {
        checkUnitTest: true,
        checkLint: false,
        checkE2E: false,
        checkExport: false,
      });

      checkFilesExist(`apps/${tailwindApp}/tailwind.config.js`);
      checkFilesExist(`apps/${tailwindApp}/postcss.config.js`);

      checkFilesDoNotExist(`apps/${tailwindApp}/app/page.module.css`);
      const appPage = readFile(`apps/${tailwindApp}/app/page.tsx`);
      const globalCss = readFile(`apps/${tailwindApp}/app/global.css`);

      expect(appPage).not.toContain(`import styles from './page.module.css';`);
      expect(globalCss).toContain(`@tailwind base;`);
    }, 500_000);
  });
});

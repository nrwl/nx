import {
  checkFilesDoNotExist,
  checkFilesExist,
  getSelectedPackageManager,
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
    // This is failing for yarn in nightly
    /* TODO(nicholas): investigate what's going on, it's a type error like this:
     Type error: Type '(App: AppType<{}>) => (props: AppPropsType<any, {}>) => ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' is not assignable to type 'Enhancer<AppType<{}>>'.
      Type '(props: AppPropsType<any, {}>) => ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' is not assignable to type 'AppType<{}>'.
        Type '(props: AppPropsType<any, {}>) => ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' is not assignable to type 'FunctionComponent<AppPropsType<any, {}>> & { getInitialProps?(context: AppContextType<NextRouter>): {} | Promise<...>; }'.
          Type '(props: AppPropsType<any, {}>) => ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' is not assignable to type 'FunctionComponent<AppPropsType<any, {}>>'.
            Type 'ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' is not assignable to type 'ReactNode'.
              Property 'children' is missing in type 'ReactElement<{ sheet: ServerStyleSheet; }, string | JSXElementConstructor<any>>' but required in type 'ReactPortal'.

      20 |     ctx.renderPage = () =>
      21 |       originalRenderPage({
    > 22 |         enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
         |         ^
      23 |         enhanceComponent: (Component) => Component,
      24 |       });
      25 |
    Warning: command "next build" exited with non-zero status code    
    */
    if (getSelectedPackageManager() === 'yarn') return;
    const lessApp = uniq('app');

    runCLI(
      `generate @nx/next:app ${lessApp} --no-interactive --style=less --appDir=false --src=false --unitTestRunner=jest --linter=eslint`
    );

    await checkApp(lessApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
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

  describe('tailwind', () => {
    it('should support --style=tailwind (pages router)', async () => {
      const tailwindApp = uniq('app');

      runCLI(
        `generate @nx/next:app ${tailwindApp} --no-interactive --style=tailwind --appDir=false --src=false --unitTestRunner=jest --linter=eslint`
      );

      await checkApp(tailwindApp, {
        checkUnitTest: true,
        checkLint: false,
        checkE2E: false,
      });

      checkFilesExist(`${tailwindApp}/tailwind.config.js`);
      checkFilesExist(`${tailwindApp}/postcss.config.js`);

      checkFilesDoNotExist(`${tailwindApp}/pages/index.module.css`);
      const appPage = readFile(`${tailwindApp}/pages/index.tsx`);
      const globalCss = readFile(`${tailwindApp}/pages/styles.css`);

      expect(appPage).not.toContain(`import styles from './index.module.css';`);
      expect(globalCss).toContain(`@tailwind base;`);
    }, 500_000);

    it('should support --style=tailwind (app router)', async () => {
      const tailwindApp = uniq('app');

      runCLI(
        `generate @nx/next:app ${tailwindApp} --no-interactive --style=tailwind --appDir=true --src=false --unitTestRunner=jest --linter=eslint`
      );

      await checkApp(tailwindApp, {
        checkUnitTest: true,
        checkLint: false,
        checkE2E: false,
      });

      checkFilesExist(`${tailwindApp}/tailwind.config.js`);
      checkFilesExist(`${tailwindApp}/postcss.config.js`);

      checkFilesDoNotExist(`${tailwindApp}/app/page.module.css`);
      const appPage = readFile(`${tailwindApp}/app/page.tsx`);
      const globalCss = readFile(`${tailwindApp}/app/global.css`);

      expect(appPage).not.toContain(`import styles from './page.module.css';`);
      expect(globalCss).toContain(`@tailwind base;`);
    }, 500_000);
  });
});

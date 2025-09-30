import {
  checkFilesDoNotExist,
  checkFilesExist,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { checkApp } from './utils';
import {
  setupNextTest,
  resetNextEnv,
  cleanupNextTest,
  NextTestSetup,
} from './next-setup';

describe('Next.js Applications - Generation', () => {
  let setup: NextTestSetup;

  beforeAll(() => {
    setup = setupNextTest();
  });

  beforeEach(() => {
    resetNextEnv(setup);
  });

  afterEach(() => {
    resetNextEnv(setup);
  });

  afterAll(() => cleanupNextTest());

  it('should support generating projects with the new name and root format', () => {
    const { proj } = setup;
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/app/page.tsx`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName} --passWithNoTests`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    runCLI(
      `generate @nx/next:lib ${libName} --buildable --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
  }, 600_000);

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

  it('should support --js flag', async () => {
    const { proj } = setup;
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --js --appDir=false --e2eTestRunner=playwright --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/src/pages/index.js`);

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });

    // Consume a JS lib
    const libName = uniq('lib');

    runCLI(
      `generate @nx/next:lib ${libName} --no-interactive --style=none --js --linter=eslint --unitTestRunner=jest`
    );

    const mainPath = `${appName}/src/pages/index.js`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n` + readFile(mainPath)
    );

    // Update lib to use css modules
    updateFile(
      `${libName}/src/lib/${libName}.js`,
      `
          import styles from './style.module.css';
          export function Test() {
            return <div className={styles.container}>Hello</div>;
          }
        `
    );
    updateFile(
      `${libName}/src/lib/style.module.css`,
      `
          .container {}
        `
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });
  }, 300_000);

  it('should support --no-swc flag', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --no-swc --linter=eslint --unitTestRunner=jest`
    );

    // Next.js enables SWC when custom .babelrc is not provided.
    checkFilesExist(`${appName}/.babelrc`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
    });
  }, 300_000);
});

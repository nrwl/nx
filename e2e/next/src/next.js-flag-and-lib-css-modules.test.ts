import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Next.js - --js flag and lib CSS modules', () => {
  let proj: string;
  let originalEnv: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/next', '@nx/cypress'] });
  });

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => cleanupProject());

  it('should support --js flag', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --js --appDir=false --e2eTestRunner=playwright --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/src/pages/index.js`);

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
  }, 300_000);
});

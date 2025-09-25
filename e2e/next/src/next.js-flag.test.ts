import {
  checkFilesExist,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';
import { checkApp } from './utils';

describe('Next.js --js flag', () => {
  const getProj = setupNextSuite();

  it('should support --js flag', async () => {
    const proj = getProj();
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

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });
  }, 300_000);
});

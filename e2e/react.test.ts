import {
  ensureProject,
  runCLI,
  uniq,
  updateFile,
  readFile,
  runCLIAsync,
  checkFilesExist,
  renameFile,
  readJson,
  forEachCli,
  supportUi,
  workspaceConfigName
} from './utils';
import { serializeJson } from '@nrwl/workspace';

forEachCli(() => {
  describe('React Applications', () => {
    it('should be able to generate a react app + lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/src/main.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.stderr).toContain('Test Suites: 1 passed, 1 total');

      await testGeneratedApp(appName);
    }, 120000);

    it('should generate app with routing', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/react:app ${appName} --routing --no-interactive`);

      await testGeneratedApp(appName);
    }, 120000);

    it('should generate app with styled-components', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${appName} --style styled-components --no-interactive`
      );

      await testGeneratedApp(appName, false);
    }, 120000);

    it('should be able to use JSX', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      renameFile(
        `apps/${appName}/src/main.tsx`,
        `apps/${appName}/src/main.jsx`
      );
      renameFile(
        `apps/${appName}/src/app/app.tsx`,
        `apps/${appName}/src/app/app.jsx`
      );
      renameFile(
        `apps/${appName}/src/app/app.spec.tsx`,
        `apps/${appName}/src/app/app.spec.jsx`
      );
      renameFile(
        `apps/${appName}/src/polyfills.ts`,
        `apps/${appName}/src/polyfills.js`
      );
      const angularJson = readJson(workspaceConfigName());

      angularJson.projects[
        appName
      ].architect.build.options.main = `apps/${appName}/src/main.jsx`;
      angularJson.projects[
        appName
      ].architect.build.options.polyfills = `apps/${appName}/src/polyfills.js`;
      updateFile(workspaceConfigName(), serializeJson(angularJson));

      const mainPath = `apps/${appName}/src/main.jsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      await testGeneratedApp(appName);
    }, 30000);

    async function testGeneratedApp(appName, styles = true) {
      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      let filesToCheck = [
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills-es2015.js`,
        `dist/apps/${appName}/runtime-es2015.js`,
        `dist/apps/${appName}/vendor-es2015.js`,
        `dist/apps/${appName}/main-es2015.js`,
        `dist/apps/${appName}/polyfills-es5.js`,
        `dist/apps/${appName}/runtime-es5.js`,
        `dist/apps/${appName}/vendor-es5.js`,
        `dist/apps/${appName}/main-es5.js`
      ];
      if (styles) {
        filesToCheck.push(
          `dist/apps/${appName}/styles-es2015.js`,
          `dist/apps/${appName}/styles-es5.js`
        );
      }
      checkFilesExist(...filesToCheck);
      expect(readFile(`dist/apps/${appName}/main-es5.js`)).toContain(
        'var App = function () {'
      );
      expect(readFile(`dist/apps/${appName}/main-es2015.js`)).toContain(
        'const App = () => {'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      filesToCheck = [
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills-es2015.js`,
        `dist/apps/${appName}/runtime-es2015.js`,
        `dist/apps/${appName}/main-es2015.js`,
        `dist/apps/${appName}/polyfills-es5.js`,
        `dist/apps/${appName}/runtime-es5.js`,
        `dist/apps/${appName}/main-es5.js`
      ];
      if (styles) {
        filesToCheck.push(`dist/apps/${appName}/styles.css`);
      }
      checkFilesExist(...filesToCheck);
      if (styles) {
        expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
          `<link rel="stylesheet" href="styles.css">`
        );
      }

      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
      const lintE2eResults = runCLI(`lint ${appName}-e2e`);
      expect(lintE2eResults).toContain('All files pass linting.');

      if (supportUi()) {
        const e2eResults = runCLI(`e2e ${appName}-e2e`);
        expect(e2eResults).toContain('All specs passed!');
      }
    }
  });
});

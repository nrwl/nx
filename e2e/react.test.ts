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

      runCLI(`generate @nrwl/react:app ${appName} --no-interactive --babel`);
      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/src/main.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.stderr).toContain('Test Suites: 1 passed, 1 total');

      await testGeneratedApp(appName, { checkStyles: true });
    }, 120000);

    it('should generate app with routing', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${appName} --routing --no-interactive --babel`
      );

      await testGeneratedApp(appName, { checkStyles: true });
    }, 120000);

    it('should generate app with styled-components', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${appName} --style styled-components --no-interactive --babel`
      );

      await testGeneratedApp(appName, { checkStyles: false });
    }, 120000);

    it('should be able to use JSX', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/react:app ${appName} --no-interactive --babel`);
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

      await testGeneratedApp(appName, { checkStyles: true });
    }, 30000);

    async function testGeneratedApp(appName, opts: { checkStyles: boolean }) {
      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      let filesToCheck = [
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/vendor.js`,
        `dist/apps/${appName}/main.js`
      ];
      if (opts.checkStyles) {
        filesToCheck.push(`dist/apps/${appName}/styles.js`);
      }
      checkFilesExist(...filesToCheck);
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'var App = function App() {'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      filesToCheck = [
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/main.js`
      ];
      if (opts.checkStyles) {
        filesToCheck.push(`dist/apps/${appName}/styles.css`);
      }
      checkFilesExist(...filesToCheck);
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

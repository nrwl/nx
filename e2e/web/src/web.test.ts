import {
  checkFilesExist,
  checkFilesDoNotExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  createFile,
} from '@nrwl/e2e/utils';

forEachCli((currentCLIName) => {
  describe('Web Components Applications', () => {
    it('should be able to generate a web app', async () => {
      ensureProject();
      const appName = uniq('app');

      const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';
      runCLI(
        `generate @nrwl/web:app ${appName} --no-interactive --linter=${linter}`
      );

      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/main.js`,
        `dist/apps/${appName}/styles.js`
      );
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'class AppElement'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.esm.js`,
        `dist/apps/${appName}/main.esm.js`,
        `dist/apps/${appName}/styles.css`
      );
      expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
        `<link rel="stylesheet" href="styles.css">`
      );
      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
      const lintE2eResults = runCLI(`lint ${appName}-e2e`);
      expect(lintE2eResults).toContain('All files pass linting.');

      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('All specs passed!');
    }, 120000);

    it('should remove previous output before building', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
      runCLI(
        `generate @nrwl/react:lib ${libName} --buildable --no-interactive`
      );

      createFile(`dist/apps/${appName}/_should_remove.txt`);
      createFile(`dist/libs/${libName}/_should_remove.txt`);
      createFile(`dist/apps/_should_not_remove.txt`);
      checkFilesExist(
        `dist/apps/${appName}/_should_remove.txt`,
        `dist/apps/_should_not_remove.txt`
      );
      runCLI(`build ${appName}`);
      runCLI(`build ${libName}`);
      checkFilesDoNotExist(
        `dist/apps/${appName}/_should_remove.txt`,
        `dist/libs/${libName}/_should_remove.txt`
      );
      checkFilesExist(`dist/apps/_should_not_remove.txt`);
    }, 120000);

    it('should do another build if differential loading is needed', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

      updateFile(`apps/${appName}/browserslist`, `IE 9-11`);

      const output = runCLI(`build ${appName} --prod --outputHashing=none`);
      checkFilesExist(
        `dist/apps/${appName}/main.esm.js`,
        `dist/apps/${appName}/main.es5.js`
      );
    }, 120000);
  });

  describe('CLI - Environment Variables', () => {
    it('should automatically load workspace and per-project environment variables', () => {
      ensureProject();

      const appName = uniq('app');
      //test if the Nx CLI loads root .env vars
      updateFile(
        `.env`,
        'NX_WS_BASE=ws-base\nNX_SHARED_ENV=shared-in-workspace-base'
      );
      updateFile(
        `.local.env`,
        'NX_WS_LOCAL=ws-local\nNX_SHARED_ENV=shared-in-workspace-local'
      );
      updateFile(
        `apps/${appName}/.env`,
        'NX_APP_BASE=app-base\nNX_SHARED_ENV=shared-in-app-base'
      );
      updateFile(
        `apps/${appName}/.local.env`,
        'NX_APP_LOCAL=app-local\nNX_SHARED_ENV=shared-in-app-local'
      );
      const main = `apps/${appName}/src/main.ts`;
      const newCode = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_LOCAL, process.env.NX_APP_BASE, process.env.NX_APP_LOCAL, process.env.NX_SHARED_ENV];`;

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

      const content = readFile(main);

      updateFile(main, `${newCode}\n${content}`);

      const appName2 = uniq('app');

      updateFile(
        `apps/${appName2}/.env`,
        'NX_APP_BASE=app2-base\nNX_SHARED_ENV=shared2-in-app-base'
      );
      updateFile(
        `apps/${appName2}/.local.env`,
        'NX_APP_LOCAL=app2-local\nNX_SHARED_ENV=shared2-in-app-local'
      );
      const main2 = `apps/${appName2}/src/main.ts`;
      const newCode2 = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_LOCAL, process.env.NX_APP_BASE, process.env.NX_APP_LOCAL, process.env.NX_SHARED_ENV];`;

      runCLI(`generate @nrwl/web:app ${appName2} --no-interactive`);

      const content2 = readFile(main2);

      updateFile(main2, `${newCode2}\n${content2}`);

      runCLI(`run-many --target=build --all`, {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          NX_BUILD: '52',
          NX_API: 'QA',
        },
      });
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'const envVars = ["test", "52", "QA", "ws-base", "ws-local", "app-base", "app-local", "shared-in-app-local"];'
      );
      expect(readFile(`dist/apps/${appName2}/main.js`)).toContain(
        'const envVars = ["test", "52", "QA", "ws-base", "ws-local", "app2-base", "app2-local", "shared2-in-app-local"];'
      );
    });
  });
});

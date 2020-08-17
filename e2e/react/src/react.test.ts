import { serializeJson } from '@nrwl/workspace';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  readJson,
  renameFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

forEachCli('nx', () => {
  describe('React Applications', () => {
    it('should be able to generate a react app + lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/react:app ${appName} --style=css --no-interactive`
      );
      runCLI(
        `generate @nrwl/react:lib ${libName} --style=css --no-interactive`
      );

      // Libs should not include package.json by default
      checkFilesDoNotExist(`libs/${libName}/package.json`);

      const mainPath = `apps/${appName}/src/main.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );

      await testGeneratedApp(appName, {
        checkStyles: true,
        checkProdBuild: true,
        checkLinter: true,
        checkE2E: true,
      });
    }, 120000);

    it('should be able to generate a publishable react lib', async () => {
      ensureProject();
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/react:lib ${libName} --publishable --importPath=@proj/${libName} --no-interactive`
      );

      const libTestResults = await runCLIAsync(
        `build ${libName} --no-extract-css`
      );
      expect(libTestResults.stdout).toContain('Bundle complete.');

      checkFilesExist(
        `dist/libs/${libName}/package.json`,
        `dist/libs/${libName}/index.d.ts`,
        `dist/libs/${libName}/${libName}.esm.js`,
        `dist/libs/${libName}/${libName}.umd.js`
      );

      checkFilesDoNotExist(
        `dist/libs/${libName}/${libName}.esm.css`,
        `dist/libs/${libName}/${libName}.umd.css`
      );

      await runCLIAsync(`build ${libName} --extract-css`);

      checkFilesExist(
        `dist/libs/${libName}/package.json`,
        `dist/libs/${libName}/index.d.ts`,
        `dist/libs/${libName}/${libName}.esm.css`,
        `dist/libs/${libName}/${libName}.esm.js`,
        `dist/libs/${libName}/${libName}.umd.css`,
        `dist/libs/${libName}/${libName}.umd.js`
      );
    }, 120000);

    it('should be able to generate a react lib with no components', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
      runCLI(
        `generate @nrwl/react:lib ${libName} --no-interactive --no-component`
      );

      const mainPath = `apps/${appName}/src/main.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.stderr).toBe('');

      await testGeneratedApp(appName, {
        checkStyles: true,
        checkProdBuild: false,
        checkLinter: false,
        checkE2E: false,
      });
    }, 120000);

    it('should not create a dist folder if there is an error', async () => {
      ensureProject();
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/react:lib ${libName} --publishable --importPath=@proj/${libName} --no-interactive`
      );

      const mainPath = `libs/${libName}/src/lib/${libName}.tsx`;
      updateFile(mainPath, readFile(mainPath) + `\n console.log(a);`); // should error - "a" will be undefined

      await expect(runCLIAsync(`build ${libName}`)).rejects.toThrow(
        /Bundle failed/
      );
      expect(() => {
        checkFilesExist(`dist/libs/${libName}/package.json`);
      }).toThrow();
    }, 120000);

    it('should generate app with routing', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/react:app ${appName} --routing --no-interactive`);

      await testGeneratedApp(appName, {
        checkStyles: true,
        checkProdBuild: false,
        checkLinter: false,
        checkE2E: false,
      });
    }, 120000);

    it('should generate app with different style options', async () => {
      ensureProject();

      const styledComponentsApp = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${styledComponentsApp} --style styled-components --no-interactive`
      );

      // Checking that we can enable displayName just for development.
      updateFile(
        `apps/${styledComponentsApp}/.babelrc`,
        JSON.stringify(
          {
            presets: ['@nrwl/react/babel'],
            env: {
              development: {
                plugins: [
                  [
                    'styled-components',
                    {
                      pure: true,
                      ssr: true,
                      displayName: true,
                    },
                  ],
                ],
              },
              production: {
                plugins: [
                  [
                    'styled-components',
                    {
                      pure: true,
                      ssr: true,
                      displayName: false,
                    },
                  ],
                ],
              },
            },
          },
          null,
          2
        )
      );

      await testGeneratedApp(styledComponentsApp, {
        checkStyles: false,
        checkProdBuild: true,
        checkLinter: false,
        checkE2E: false,
      });

      expect(readFile(`dist/apps/${styledComponentsApp}/main.js`)).toContain(
        'app__StyledApp'
      );
      expect(
        readFile(`dist/apps/${styledComponentsApp}/prod/main.esm.js`)
      ).not.toContain('app__StyledApp');

      const styledJsxApp = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${styledJsxApp} --style styled-jsx --no-interactive`
      );

      await testGeneratedApp(styledJsxApp, {
        checkStyles: false,
        checkProdBuild: false,
        checkLinter: false,
        checkE2E: false,
      });

      const noStylesApp = uniq('app');

      runCLI(
        `generate @nrwl/react:app ${noStylesApp} --style none --no-interactive`
      );

      await testGeneratedApp(noStylesApp, {
        checkStyles: false,
        checkProdBuild: false,
        checkLinter: false,
        checkE2E: false,
      });

      expect(() =>
        checkFilesExist(`dist/apps/${noStylesApp}/styles.css`)
      ).toThrow(/does not exist/);
      expect(readFile(`dist/apps/${noStylesApp}/index.html`)).not.toContain(
        `<link rel="stylesheet" href="styles.css">`
      );
    }, 120000);

    it('should be able to add a redux slice', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`g @nrwl/react:app ${appName} --no-interactive`);
      runCLI(`g @nrwl/react:redux lemon --project=${appName}`);
      runCLI(`g @nrwl/react:lib ${libName} --no-interactive`);
      runCLI(`g @nrwl/react:redux orange --project=${libName}`);

      const appTestResults = await runCLIAsync(`test ${appName}`);
      expect(appTestResults.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );

      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );
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

      await testGeneratedApp(appName, {
        checkStyles: true,
        checkProdBuild: false,
        checkLinter: false,
        checkE2E: false,
      });
    }, 30000);

    async function testGeneratedApp(
      appName,
      opts: {
        checkProdBuild: boolean;
        checkStyles: boolean;
        checkLinter: boolean;
        checkE2E: boolean;
      }
    ) {
      if (opts.checkLinter) {
        const lintResults = runCLI(`lint ${appName}`);
        expect(lintResults).toContain('All files pass linting.');
      }

      runCLI(`build ${appName}`);
      let filesToCheck = [
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/vendor.js`,
        `dist/apps/${appName}/main.js`,
      ];
      if (opts.checkStyles) {
        filesToCheck.push(`dist/apps/${appName}/styles.js`);
      }
      checkFilesExist(...filesToCheck);

      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'const App = () =>'
      );

      if (opts.checkProdBuild) {
        const prodOutputPath = `dist/apps/${appName}/prod`;
        runCLI(
          `build ${appName} --prod --output-hashing none --outputPath ${prodOutputPath}`
        );
        filesToCheck = [
          `${prodOutputPath}/index.html`,
          `${prodOutputPath}/runtime.js`,
          `${prodOutputPath}/polyfills.esm.js`,
          `${prodOutputPath}/main.esm.js`,
        ];
        if (opts.checkStyles) {
          filesToCheck.push(`${prodOutputPath}/styles.css`);
        }
        checkFilesExist(...filesToCheck);

        if (opts.checkStyles) {
          expect(readFile(`${prodOutputPath}/index.html`)).toContain(
            `<link rel="stylesheet" href="styles.css">`
          );
        }
      }

      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );

      if (opts.checkE2E) {
        const e2eResults = runCLI(`e2e ${appName}-e2e`);
        expect(e2eResults).toContain('All specs passed!');
      }
    }
  });
});

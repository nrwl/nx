import {
  checkFilesDoNotExist,
  checkFilesExist,
  killPorts,
  newProject,
  readFile,
  renameFile,
  runCLI,
  runCLIAsync,
  runCypressTests,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('React Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should be able to generate a react app + lib', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/react:app ${appName} --style=css --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --style=css --no-interactive`);

    // Libs should not include package.json by default
    checkFilesDoNotExist(`libs/${libName}/package.json`);

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n${readFile(mainPath)}`
    );

    const libTestResults = await runCLIAsync(`test ${libName}`);
    expect(libTestResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: true,
      checkE2E: true,
    });
  }, 500000);

  it('should support sourcemaps', () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);

    runCLI(`build ${appName} --sourceMap --outputHashing none`);

    checkFilesExist(`dist/apps/${appName}/main.esm.js.map`);
  }, 250000);

  it('should be able to generate a publishable react lib', async () => {
    const libName = uniq('lib');

    runCLI(
      `generate @nrwl/react:lib ${libName} --publishable --importPath=@${proj}/${libName} --no-interactive`
    );

    const libTestResults = await runCLIAsync(
      `build ${libName} --no-extract-css`
    );
    expect(libTestResults.stdout).toMatch(/Done in \d+\.\d+s/);

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
  }, 250000);

  it('should be able to generate a react lib with no components', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/react:lib ${libName} --no-interactive --no-component`
    );

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n${readFile(mainPath)}`
    );

    const libTestResults = await runCLIAsync(`test ${libName}`);
    expect(libTestResults.stderr).toBe('');

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: false,
      checkE2E: false,
    });
  }, 250000);

  it('should not create a dist folder if there is an error', async () => {
    const libName = uniq('lib');

    runCLI(
      `generate @nrwl/react:lib ${libName} --publishable --importPath=@${proj}/${libName} --no-interactive`
    );

    const mainPath = `libs/${libName}/src/lib/${libName}.tsx`;
    updateFile(mainPath, `${readFile(mainPath)}\n console.log(a);`); // should error - "a" will be undefined

    await expect(runCLIAsync(`build ${libName}`)).rejects.toThrow(
      /Bundle failed/
    );
    expect(() => {
      checkFilesExist(`dist/libs/${libName}/package.json`);
    }).toThrow();
  }, 250000);

  it('should generate app with routing', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/react:app ${appName} --routing --no-interactive`);

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: false,
      checkE2E: false,
    });
  }, 250000);

  it('should generate app with different style options', async () => {
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
          plugins: [
            ['styled-components', { pure: true, ssr: true, displayName: true }],
          ],
          env: {
            production: {
              plugins: [
                [
                  'styled-components',
                  { pure: true, ssr: true, displayName: false },
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
      checkLinter: false,
      checkE2E: false,
    });

    const styledJsxApp = uniq('app');

    runCLI(
      `generate @nrwl/react:app ${styledJsxApp} --style styled-jsx --no-interactive`
    );

    await testGeneratedApp(styledJsxApp, {
      checkStyles: false,
      checkLinter: false,
      checkE2E: false,
    });

    const noStylesApp = uniq('app');

    runCLI(
      `generate @nrwl/react:app ${noStylesApp} --style none --no-interactive`
    );

    await testGeneratedApp(noStylesApp, {
      checkStyles: false,
      checkLinter: false,
      checkE2E: false,
    });

    expect(() =>
      checkFilesExist(`dist/apps/${noStylesApp}/styles.css`)
    ).toThrow(/does not exist/);
    expect(readFile(`dist/apps/${noStylesApp}/index.html`)).not.toContain(
      `<link rel="stylesheet" href="styles.css">`
    );
  }, 250000);

  it('should generate app with legacy-ie support', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/react:app ${appName} --style=css --no-interactive`);

    // changing browser support of this application
    updateFile(`apps/${appName}/.browserslistrc`, `IE 11`);

    await testGeneratedApp(appName, {
      checkStyles: false,
      checkLinter: false,
      checkE2E: false,
    });

    const filesToCheck = [
      `dist/apps/${appName}/polyfills.es5.js`,
      `dist/apps/${appName}/main.es5.js`,
    ];

    checkFilesExist(...filesToCheck);

    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      `<script src="main.esm.js" type="module"></script><script src="main.es5.js" nomodule defer></script>`
    );
  }, 250000);

  it('should be able to add a redux slice', async () => {
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
  }, 250000);

  it('should be able to use JSX', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

    renameFile(`apps/${appName}/src/main.tsx`, `apps/${appName}/src/main.jsx`);
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
    updateProjectConfig(appName, (config) => {
      config.targets.build.options.main = `apps/${appName}/src/main.jsx`;
      config.targets.build.options.polyfills = `apps/${appName}/src/polyfills.js`;
      return config;
    });

    const mainPath = `apps/${appName}/src/main.jsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n${readFile(mainPath)}`
    );

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: false,
      checkE2E: false,
    });
  }, 250000);

  async function testGeneratedApp(
    appName,
    opts: {
      checkStyles: boolean;
      checkLinter: boolean;
      checkE2E: boolean;
    }
  ) {
    if (opts.checkLinter) {
      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');
    }

    runCLI(`build ${appName} --outputHashing none`);
    const filesToCheck = [
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.esm.js`,
      `dist/apps/${appName}/polyfills.esm.js`,
      `dist/apps/${appName}/main.esm.js`,
    ];
    if (opts.checkStyles) {
      filesToCheck.push(`dist/apps/${appName}/styles.css`);
    }
    checkFilesExist(...filesToCheck);

    if (opts.checkStyles) {
      expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
        `<link rel="stylesheet" href="styles.css">`
      );
    }

    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    if (opts.checkE2E && runCypressTests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e --headless --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }
  }
});

fdescribe('--style option', () => {
  beforeAll(() => newProject());

  it.each`
    style
    ${'css'}
    ${'scss'}
    ${'less'}
    ${'styl'}
  `('should support global and css modules', ({ style }) => {
    const appName = uniq('app');
    runCLI(
      `generate @nrwl/react:app ${appName} --style=${style} --no-interactive`
    );

    // make sure stylePreprocessorOptions works
    updateProjectConfig(appName, (config) => {
      config.targets.build.options.stylePreprocessorOptions = {
        includePaths: ['libs/shared/lib'],
      };
      return config;
    });
    updateFile(
      `apps/${appName}/src/styles.${style}`,
      `@import 'base.${style}';`
    );
    updateFile(
      `apps/${appName}/src/app/app.module.${style}`,
      (s) => `@import 'base.${style}';\n${s}`
    );
    updateFile(
      `libs/shared/lib/base.${style}`,
      `body { font-family: "Comic Sans MS"; }`
    );

    runCLI(`build ${appName} --outputHashing none`);

    expect(readFile(`dist/apps/${appName}/styles.css`)).toMatch(
      /Comic Sans MS/
    );
  });
});

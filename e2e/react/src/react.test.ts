import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  expectJestTestsToPass,
  killPorts,
  newProject,
  readFile,
  renameFile,
  runCLI,
  runCLIAsync,
  runCypressTests,
  uniq,
  updateFile,
  updateJson,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('React Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should be able to generate a react app + lib', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');
    const libWithNoComponents = uniq('lib');

    runCLI(`generate @nrwl/react:app ${appName} --style=css --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --style=css --no-interactive`);
    runCLI(
      `generate @nrwl/react:lib ${libWithNoComponents} --no-interactive --no-component`
    );

    // Libs should not include package.json by default
    checkFilesDoNotExist(`libs/${libName}/package.json`);

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `
        import '@${proj}/${libWithNoComponents}';
        import '@${proj}/${libName}';
        ${readFile(mainPath)}
      `
    );

    const libTestResults = await runCLIAsync(`test ${libName}`);
    expect(libTestResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    await testGeneratedApp(appName, {
      checkSourceMap: true,
      checkStyles: true,
      checkLinter: true,
      checkE2E: true,
    });
  }, 500000);

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
  }, 250_000);

  it('should be able to use JS and JSX', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/react:app ${appName} --no-interactive --js`);
    runCLI(`generate @nrwl/react:lib ${libName} --no-interactive --js`);

    const mainPath = `apps/${appName}/src/main.js`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n${readFile(mainPath)}`
    );

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: false,
      checkE2E: false,
    });
  }, 250_000);

  async function testGeneratedApp(
    appName,
    opts: {
      checkStyles: boolean;
      checkLinter: boolean;
      checkE2E: boolean;
      checkSourceMap?: boolean;
    }
  ) {
    if (opts.checkLinter) {
      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');
    }

    runCLI(
      `build ${appName} --outputHashing none ${
        opts.checkSourceMap ? '--sourceMap' : ''
      }`
    );
    const filesToCheck = [
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.esm.js`,
      `dist/apps/${appName}/polyfills.esm.js`,
      `dist/apps/${appName}/main.esm.js`,
    ];

    if (opts.checkSourceMap) {
      filesToCheck.push(`dist/apps/${appName}/main.esm.js.map`);
    }

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
      const e2eResults = runCLI(`e2e ${appName}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }
  }
});

describe('React Applications: --style option', () => {
  // Only create workspace once
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

describe('React Applications: additional packages', () => {
  beforeAll(() => newProject());

  it('should generate app with routing', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/react:app ${appName} --routing --no-interactive`);

    runCLI(`build ${appName} --outputHashing none`);

    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.esm.js`,
      `dist/apps/${appName}/polyfills.esm.js`,
      `dist/apps/${appName}/main.esm.js`
    );
  }, 250_000);

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
  }, 250_000);
});

describe('React Applications and Libs with PostCSS', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));

  it('should support single path or auto-loading of PostCSS config files', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`g @nrwl/react:app ${appName} --no-interactive`);
    runCLI(`g @nrwl/react:lib ${libName} --no-interactive`);

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n${readFile(mainPath)}`
    );

    createFile(
      `apps/${appName}/postcss.config.js`,
      `
      console.log('HELLO FROM APP'); // need this output for e2e test
      module.exports = {};
    `
    );
    createFile(
      `libs/${libName}/postcss.config.js`,
      `
      console.log('HELLO FROM LIB'); // need this output for e2e test
      module.exports = {};
    `
    );

    let buildResults = await runCLIAsync(`build ${appName}`);

    expect(buildResults.combinedOutput).toMatch(/HELLO FROM APP/);
    expect(buildResults.combinedOutput).toMatch(/HELLO FROM LIB/);

    // Only load app PostCSS config
    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build.options.postcssConfig = `apps/${appName}/postcss.config.js`;
      return json;
    });

    buildResults = await runCLIAsync(`build ${appName}`);

    expect(buildResults.combinedOutput).toMatch(/HELLO FROM APP/);
    expect(buildResults.combinedOutput).not.toMatch(/HELLO FROM LIB/);
  }, 250_000);

  it('should run default jest tests', async () => {
    await expectJestTestsToPass('@nrwl/react:lib');
    await expectJestTestsToPass('@nrwl/react:app');
  }, 200000);
});

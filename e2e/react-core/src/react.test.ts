import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  ensureCypressInstallation,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runCypressTests,
  uniq,
  updateFile,
  updateJson,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { readFileSync } from 'fs-extra';
import { join } from 'path';

describe('React Applications', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject();
    ensureCypressInstallation();
  });

  afterAll(() => cleanupProject());

  it('should be able to generate a react app + lib (with CSR and SSR)', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');
    const libWithNoComponents = uniq('lib');
    const logoSvg = readFileSync(join(__dirname, 'logo.svg')).toString();

    runCLI(
      `generate @nrwl/react:app ${appName} --style=css --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:lib ${libName} --style=css --no-interactive --unit-test-runner=jest`
    );
    runCLI(
      `generate @nrwl/react:lib ${libWithNoComponents} --no-interactive --no-component --unit-test-runner=jest`
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

    updateFile(`apps/${appName}/src/app/logo.svg`, logoSvg);
    updateFile(
      `apps/${appName}/src/app/app.tsx`,
      `
        import { ReactComponent as Logo } from './logo.svg';
        import logo from './logo.svg';
        import NxWelcome from './nx-welcome';

        export function App() {
          return (
            <>
              <Logo />
              <img src={logo} alt="" />
              <NxWelcome title="${appName}" />
            </>
          );
        }

        export default App;
      `
    );

    // Make sure global stylesheets are properly processed.
    const stylesPath = `apps/${appName}/src/styles.css`;
    updateFile(
      stylesPath,
      `
        .foobar {
          background-image: url('/bg.png');
        }
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
      // TODO(caleb): Fix cypress tests
      // /tmp/nx-e2e--1970-rQ4U0qBe6Nht/nx/proj1614306/dist/apps/app5172641/server/runtime.js:119
      // if (typeof import.meta.url === "string") scriptUrl = import.meta.url
      // SyntaxError: Cannot use 'import.meta' outside a module
      checkE2E: false,
    });

    // Set up SSR and check app
    runCLI(`generate @nrwl/react:setup-ssr ${appName}`);
    checkFilesExist(`apps/${appName}/src/main.server.tsx`);
    checkFilesExist(`apps/${appName}/server.ts`);

    await testGeneratedApp(appName, {
      checkSourceMap: false,
      checkStyles: false,
      checkLinter: false,
      // TODO(caleb): Fix cypress tests
      // /tmp/nx-e2e--1970-rQ4U0qBe6Nht/nx/proj1614306/dist/apps/app5172641/server/runtime.js:119
      // if (typeof import.meta.url === "string") scriptUrl = import.meta.url
      // SyntaxError: Cannot use 'import.meta' outside a module
      checkE2E: false,
    });
  }, 500000);

  it('should be able to use JS and JSX', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');
    const plainJsLib = uniq('jslib');

    runCLI(
      `generate @nrwl/react:app ${appName} --bundler=webpack --no-interactive --js`
    );
    runCLI(
      `generate @nrwl/react:lib ${libName} --no-interactive --js --unit-test-runner=none`
    );
    // Make sure plain JS libs can be imported as well.
    // There was an issue previously: https://github.com/nrwl/nx/issues/10990
    runCLI(
      `generate @nrwl/js:lib ${plainJsLib} --js --unit-test-runner=none --bundler=none --compiler=tsc --no-interactive`
    );

    const mainPath = `apps/${appName}/src/main.js`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\nimport '@${proj}/${plainJsLib}';\n${readFile(
        mainPath
      )}`
    );

    await testGeneratedApp(appName, {
      checkStyles: true,
      checkLinter: false,
      checkE2E: false,
    });
  }, 250_000);

  it('should be able to use Vite to build and test apps', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nrwl/react:app ${appName} --bundler=vite --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest`
    );

    // Library generated with Vite
    checkFilesExist(`libs/${libName}/vite.config.ts`);

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `
        import '@${proj}/${libName}';
        ${readFile(mainPath)}
      `
    );

    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/index.html`);

    const e2eResults = runCLI(`e2e ${appName}-e2e --no-watch`);
    expect(e2eResults).toContain('All specs passed!');
    expect(await killPorts()).toBeTruthy();
  }, 250_000);

  it('should generate app with routing', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/react:app ${appName} --routing --bundler=webpack --no-interactive`
    );

    runCLI(`build ${appName} --outputHashing none`);

    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/main.js`
    );
  }, 250_000);

  it('should be able to add a redux slice', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`g @nrwl/react:app ${appName} --bundler=webpack --no-interactive`);
    runCLI(`g @nrwl/react:redux lemon --project=${appName}`);
    runCLI(
      `g @nrwl/react:lib ${libName} --unit-test-runner=jest --no-interactive`
    );
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

  describe('React Applications: --style option', () => {
    it.each`
      style
      ${'css'}
      ${'scss'}
      ${'less'}
      ${'styl'}
    `('should support global and css modules', ({ style }) => {
      const appName = uniq('app');
      runCLI(
        `generate @nrwl/react:app ${appName} --style=${style} --bundler=webpack --no-interactive`
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

  describe('React Applications and Libs with PostCSS', () => {
    it('should support single path or auto-loading of PostCSS config files', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`g @nrwl/react:app ${appName} --bundler=webpack --no-interactive`);
      runCLI(
        `g @nrwl/react:lib ${libName} --no-interactive --unit-test-runner=none`
      );

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
  });
});

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
    `dist/apps/${appName}/runtime.js`,
    `dist/apps/${appName}/main.js`,
  ];

  if (opts.checkSourceMap) {
    filesToCheck.push(`dist/apps/${appName}/main.js.map`);
  }

  if (opts.checkStyles) {
    filesToCheck.push(`dist/apps/${appName}/styles.css`);
  }
  checkFilesExist(...filesToCheck);

  if (opts.checkStyles) {
    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      '<link rel="stylesheet" href="styles.css">'
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

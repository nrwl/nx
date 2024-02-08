import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  ensureCypressInstallation,
  killPorts,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { readFileSync } from 'fs-extra';
import { join } from 'path';

describe('React Applications', () => {
  let proj: string;

  describe('Crystal Supported Tests', () => {
    beforeAll(() => {
      proj = newProject({ packages: ['@nx/react'] });
      ensureCypressInstallation();
    });

    afterAll(() => cleanupProject());

    it('should be able to generate a react app + lib (with CSR and SSR)', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');
      const libWithNoComponents = uniq('lib');
      const logoSvg = readFileSync(join(__dirname, 'logo.svg')).toString();

      runCLI(
        `generate @nx/react:app ${appName} --style=css --bundler=webpack --no-interactive --skipFormat`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --style=css --no-interactive --unit-test-runner=jest --skipFormat`
      );
      runCLI(
        `generate @nx/react:lib ${libWithNoComponents} --no-interactive --no-component --unit-test-runner=jest --skipFormat`
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
      runCLI(`generate @nx/react:setup-ssr ${appName} --skipFormat`);
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

    // TODO(crystal, @jaysoo): Investigate why this is failing.
    it('should be able to use Vite to build and test apps', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:app ${appName} --bundler=vite --no-interactive --skipFormat`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest --skipFormat`
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

      if (runE2ETests()) {
        const e2eResults = runCLI(`e2e ${appName}-e2e`, {
          env: {
            DEBUG: 'cypress:server:*',
          },
        });
        expect(e2eResults).toContain('All specs passed!');
        expect(await killPorts()).toBeTruthy();
      }
    }, 250_000);

    it('should generate app with routing', async () => {
      const appName = uniq('app');

      runCLI(
        `generate @nx/react:app ${appName} --routing --bundler=webpack --no-interactive --skipFormat`
      );

      runCLI(`build ${appName}`);

      checkFilesExistWithHash(`dist/apps/${appName}`, [
        `index.html`,
        `runtime.*.js`,
        `main.*.js`,
      ]);
    }, 250_000);

    it('should be able to add a redux slice', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `g @nx/react:app ${appName} --bundler=webpack --no-interactive --skipFormat`
      );
      runCLI(`g @nx/react:redux lemon --project=${appName} --skipFormat`);
      runCLI(
        `g @nx/react:lib ${libName} --unit-test-runner=jest --no-interactive --skipFormat`
      );
      runCLI(`g @nx/react:redux orange --project=${libName} --skipFormat`);

      let lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain(
        `Successfully ran target lint for project ${appName}`
      );
      const appTestResults = await runCLIAsync(`test ${appName}`);
      expect(appTestResults.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );

      lintResults = runCLI(`lint ${libName}`);
      expect(lintResults).toContain(
        `Successfully ran target lint for project ${libName}`
      );
      const libTestResults = await runCLIAsync(`test ${libName}`);
      expect(libTestResults.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );
    }, 250_000);

    it('should support generating projects with the new name and root format', () => {
      const appName = uniq('app1');
      const libName = uniq('@my-org/lib1');

      runCLI(
        `generate @nx/react:app ${appName} --bundler=webpack --project-name-and-root-format=as-provided --no-interactive --skipFormat`
      );

      // check files are generated without the layout directory ("apps/") and
      // using the project name as the directory when no directory is provided
      checkFilesExist(`${appName}/src/main.tsx`);
      // check build works
      expect(runCLI(`build ${appName}`)).toContain(
        `Successfully ran target build for project ${appName}`
      );
      // check tests pass
      const appTestResult = runCLI(`test ${appName}`);
      expect(appTestResult).toContain(
        `Successfully ran target test for project ${appName}`
      );

      // assert scoped project names are not supported when --project-name-and-root-format=derived
      expect(() =>
        runCLI(
          `generate @nx/react:lib ${libName} --unit-test-runner=jest --buildable --project-name-and-root-format=derived --no-interactive --skipFormat`
        )
      ).toThrow();

      runCLI(
        `generate @nx/react:lib ${libName} --unit-test-runner=jest --buildable --project-name-and-root-format=as-provided --no-interactive --skipFormat`
      );

      // check files are generated without the layout directory ("libs/") and
      // using the project name as the directory when no directory is provided
      checkFilesExist(`${libName}/src/index.ts`);
      // check build works
      expect(runCLI(`build ${libName}`)).toContain(
        `Successfully ran target build for project ${libName}`
      );
      // check tests pass
      const libTestResult = runCLI(`test ${libName}`);
      expect(libTestResult).toContain(
        `Successfully ran target test for project ${libName}`
      );
    }, 500_000);

    describe('React Applications: --style option', () => {
      // TODO(crystal, @jaysoo): Investigate why this is failng
      xit('should support styled-jsx', async () => {
        const appName = uniq('app');
        runCLI(
          `generate @nx/react:app ${appName} --style=styled-jsx --bundler=vite --no-interactive --skipFormat`
        );

        // update app to use styled-jsx
        updateFile(
          `apps/${appName}/src/app/app.tsx`,
          `
       import NxWelcome from './nx-welcome';

        export function App() {
          return (
            <div>
              <style jsx>{'h1 { color: red }'}</style>

              <NxWelcome title="${appName}" />
            </div>
          );
        }

        export default App;

       `
        );

        // update e2e test to check for styled-jsx change

        updateFile(
          `apps/${appName}-e2e/src/e2e/app.cy.ts`,
          `
       describe('react-test', () => {
        beforeEach(() => cy.visit('/'));
      
        it('should have red colour', () => {

          cy.get('h1').should('have.css', 'color', 'rgb(255, 0, 0)');
        });
      });
      
       `
        );
        if (runE2ETests()) {
          const e2eResults = runCLI(`e2e ${appName}-e2e --verbose`);
          expect(e2eResults).toContain('All specs passed!');
        }
      }, 250_000);
    });

    describe('--format', () => {
      it('should be formatted on freshly created apps', async () => {
        const appName = uniq('app');
        runCLI(
          `generate @nx/react:app ${appName} --bundler=webpack --no-interactive`
        );

        const stdout = runCLI(`format:check --projects=${appName}`, {
          silenceError: true,
        });
        expect(stdout).toEqual('');
      });
    });
  });

  // TODO(colum): Revisit when cypress --js works with crystal
  describe('Non-Crystal Tests', () => {
    beforeAll(() => {
      process.env.NX_ADD_PLUGINS = 'false';
      proj = newProject({ packages: ['@nx/react'] });
      ensureCypressInstallation();
    });

    afterAll(() => {
      cleanupProject();
      delete process.env.NX_ADD_PLUGINS;
    });

    it('should be able to use JS and JSX', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');
      const plainJsLib = uniq('jslib');

      runCLI(
        `generate @nx/react:app ${appName} --bundler=webpack --no-interactive --js --skipFormat`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --no-interactive --js --unit-test-runner=none --skipFormat`
      );
      // Make sure plain JS libs can be imported as well.
      // There was an issue previously: https://github.com/nrwl/nx/issues/10990
      runCLI(
        `generate @nx/js:lib ${plainJsLib} --js --unit-test-runner=none --bundler=none --compiler=tsc --no-interactive --skipFormat`
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

    it.each`
      style
      ${'css'}
      ${'scss'}
      ${'less'}
    `('should support global and css modules', async ({ style }) => {
      const appName = uniq('app');
      runCLI(
        `generate @nx/react:app ${appName} --style=${style} --bundler=webpack --no-interactive --skipFormat`
      );

      // make sure stylePreprocessorOptions works
      updateJson(join('apps', appName, 'project.json'), (config) => {
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

    describe('React Applications and Libs with PostCSS', () => {
      it('should support single path or auto-loading of PostCSS config files', async () => {
        const appName = uniq('app');
        const libName = uniq('lib');

        runCLI(
          `g @nx/react:app ${appName} --bundler=webpack --no-interactive --skipFormat`
        );
        runCLI(
          `g @nx/react:lib ${libName} --no-interactive --unit-test-runner=none --skipFormat`
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
    expect(lintResults).toContain(
      `Successfully ran target lint for project ${appName}`
    );
  }

  runCLI(`build ${appName}`);
  const filesToCheck = [`index.html`, `runtime.*.js`, `main.*.js`];

  if (opts.checkStyles) {
    filesToCheck.push(`styles.*.css`);
    expect(
      /styles.*.css/.test(readFile(`dist/apps/${appName}/index.html`))
    ).toBeTruthy();
  }

  checkFilesExistWithHash(`dist/apps/${appName}`, filesToCheck);

  const testResults = await runCLIAsync(`test ${appName}`);
  expect(testResults.combinedOutput).toContain(
    'Test Suites: 1 passed, 1 total'
  );

  if (opts.checkE2E && runE2ETests()) {
    const e2eResults = runCLI(`e2e ${appName}-e2e`);
    expect(e2eResults).toContain('All specs passed!');
    expect(await killPorts()).toBeTruthy();
  }
}

function checkFilesExistWithHash(
  outputDirToCheck: string,
  filesToCheck: string[]
) {
  const filesInOutputDir = listFiles(outputDirToCheck);
  // REGEX CHECK
  for (const fileToCheck of filesToCheck) {
    const regex = new RegExp(fileToCheck);
    let found = false;
    for (const fileInOutput of filesInOutputDir) {
      if (regex.test(fileInOutput)) {
        found = true;
      }
    }
    expect(found).toBeTruthy();
  }
}

import * as path from 'path';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import * as ts from 'typescript';

describe('Linter', () => {
  describe('Integrated', () => {
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    let projScope;

    beforeAll(() => {
      projScope = newProject({
        packages: ['@nx/react', '@nx/js', '@nx/eslint'],
      });
      runCLI(`generate @nx/react:app ${myapp} --tags=validtag`);
      runCLI(`generate @nx/js:lib ${mylib}`);
    });
    afterAll(() => cleanupProject());

    describe('linting errors', () => {
      let defaultEslintrc;

      beforeAll(() => {
        updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);
        defaultEslintrc = readJson('.eslintrc.json');
      });
      afterEach(() => {
        updateFile('.eslintrc.json', JSON.stringify(defaultEslintrc, null, 2));
      });

      it('should check for linting errors', () => {
        // create faulty file
        updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);
        const eslintrc = readJson('.eslintrc.json');

        // set the eslint rules to error
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        let out = runCLI(`lint ${myapp}`, { silenceError: true });
        expect(out).toContain('Unexpected console statement');

        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = undefined;
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        // 3. linting should not error when all rules are followed
        out = runCLI(`lint ${myapp}`, { silenceError: true });
        expect(out).toContain('Successfully ran target lint');
      }, 1000000);

      it('should cache eslint with --cache', () => {
        function readCacheFile(cacheFile) {
          const cacheInfo = readFile(cacheFile);
          return process.platform === 'win32'
            ? cacheInfo.replace(/\\\\/g, '\\')
            : cacheInfo;
        }

        // should generate a default cache file
        let cachePath = path.join('apps', myapp, '.eslintcache');
        expect(() => checkFilesExist(cachePath)).toThrow();
        runCLI(`lint ${myapp} --cache`, { silenceError: true });
        expect(() => checkFilesExist(cachePath)).not.toThrow();
        expect(readCacheFile(cachePath)).toContain(
          path.normalize(`${myapp}/src/app/app.spec.tsx`)
        );

        // should let you specify a cache file location
        cachePath = path.join('apps', myapp, 'my-cache');
        expect(() => checkFilesExist(cachePath)).toThrow();
        runCLI(`lint ${myapp} --cache --cache-location="my-cache"`, {
          silenceError: true,
        });
        expect(() => checkFilesExist(cachePath)).not.toThrow();
        expect(readCacheFile(cachePath)).toContain(
          path.normalize(`${myapp}/src/app/app.spec.tsx`)
        );
      });

      it('linting should generate an output file with a specific format', () => {
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        const outputFile = 'a/b/c/lint-output.json';
        const outputFilePath = path.join('apps', myapp, outputFile);
        expect(() => {
          checkFilesExist(outputFilePath);
        }).toThrow();
        const stdout = runCLI(
          `lint ${myapp} --output-file="${outputFile}" --format=json`,
          {
            silenceError: true,
          }
        );
        expect(stdout).not.toContain('Unexpected console statement');
        expect(() => checkFilesExist(outputFilePath)).not.toThrow();
        const outputContents = JSON.parse(readFile(outputFilePath));
        const outputForApp: any = Object.values(outputContents).filter(
          (result: any) =>
            result.filePath.includes(path.normalize(`${myapp}/src/main.ts`))
        )[0];
        expect(outputForApp.errorCount).toBe(1);
        expect(outputForApp.messages[0].ruleId).toBe('no-console');
        expect(outputForApp.messages[0].message).toBe(
          'Unexpected console statement.'
        );
      }, 1000000);

      it('should support creating, testing and using workspace lint rules', () => {
        const messageId = 'e2eMessageId';
        const libMethodName = 'getMessageId';

        // add custom function
        updateFile(
          `libs/${mylib}/src/lib/${mylib}.ts`,
          `export const ${libMethodName} = (): '${messageId}' => '${messageId}';`
        );

        // Generate a new rule (should also scaffold the required workspace project and tests)
        const newRuleName = 'e2e-test-rule-name';
        runCLI(`generate @nx/eslint:workspace-rule ${newRuleName}`);

        // Ensure that the unit tests for the new rule are runnable
        const unitTestsOutput = runCLI(`test eslint-rules`);
        expect(unitTestsOutput).toContain('Successfully ran target test');

        // Update the rule for the e2e test so that we can assert that it produces the expected lint failure when used
        const knownLintErrorMessage = 'e2e test known error message';
        const newRulePath = `tools/eslint-rules/rules/${newRuleName}.ts`;
        const newRuleGeneratedContents = readFile(newRulePath);
        const updatedRuleContents = updateGeneratedRuleImplementation(
          newRulePath,
          newRuleGeneratedContents,
          knownLintErrorMessage,
          messageId,
          libMethodName,
          `@${projScope}/${mylib}`
        );
        updateFile(newRulePath, updatedRuleContents);

        const newRuleNameForUsage = `@nx/workspace-${newRuleName}`;

        // Add the new workspace rule to the lint config and run linting
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules[newRuleNameForUsage] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        const lintOutput = runCLI(`lint ${myapp} --verbose`, {
          silenceError: true,
        });
        expect(lintOutput).toContain(newRuleNameForUsage);
        expect(lintOutput).toContain(knownLintErrorMessage);
      }, 1000000);

      it('lint plugin should ensure module boundaries', () => {
        const myapp2 = uniq('myapp2');
        const lazylib = uniq('lazylib');
        const invalidtaglib = uniq('invalidtaglib');
        const validtaglib = uniq('validtaglib');

        runCLI(`generate @nx/react:app ${myapp2}`);
        runCLI(`generate @nx/react:lib ${lazylib}`);
        runCLI(`generate @nx/js:lib ${invalidtaglib} --tags=invalidtag`);
        runCLI(`generate @nx/js:lib ${validtaglib} --tags=validtag`);

        const eslint = readJson('.eslintrc.json');
        eslint.overrides[0].rules[
          '@nx/enforce-module-boundaries'
        ][1].depConstraints = [
          { sourceTag: 'validtag', onlyDependOnLibsWithTags: ['validtag'] },
          ...eslint.overrides[0].rules['@nx/enforce-module-boundaries'][1]
            .depConstraints,
        ];
        updateFile('.eslintrc.json', JSON.stringify(eslint, null, 2));

        const tsConfig = readJson('tsconfig.base.json');

        /**
         * apps do not add themselves to the tsconfig file.
         *
         * Let's add it so that we can trigger the lint failure
         */
        tsConfig.compilerOptions.paths[`@${projScope}/${myapp2}`] = [
          `apps/${myapp2}/src/main.ts`,
        ];

        tsConfig.compilerOptions.paths[`@secondScope/${lazylib}`] =
          tsConfig.compilerOptions.paths[`@${projScope}/${lazylib}`];
        delete tsConfig.compilerOptions.paths[`@${projScope}/${lazylib}`];
        updateFile('tsconfig.base.json', JSON.stringify(tsConfig, null, 2));

        updateFile(
          `apps/${myapp}/src/main.ts`,
          `
        import '../../../libs/${mylib}';
        import '@secondScope/${lazylib}';
        import '@${projScope}/${myapp2}';
        import '@${projScope}/${invalidtaglib}';
        import '@${projScope}/${validtaglib}';

        const s = {loadChildren: '@secondScope/${lazylib}'};
      `
        );

        const out = runCLI(`lint ${myapp}`, { silenceError: true });
        expect(out).toContain(
          'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope'
        );
        expect(out).toContain('Imports of apps are forbidden');
        expect(out).toContain(
          'A project tagged with "validtag" can only depend on libs tagged with "validtag"'
        );
      }, 1000000);
    });

    describe('workspace boundary rules', () => {
      const libA = uniq('tslib-a');
      const libB = uniq('tslib-b');
      const libC = uniq('tslib-c');

      beforeAll(() => {
        // make these libs non-buildable to avoid dep-checks triggering lint errors
        runCLI(`generate @nx/js:lib ${libA} --bundler=none`);
        runCLI(`generate @nx/js:lib ${libB} --bundler=none`);
        runCLI(`generate @nx/js:lib ${libC} --bundler=none`);

        /**
         * create tslib-a structure
         */
        createFile(
          `libs/${libA}/src/lib/tslib-a.ts`,
          `
        export function libASayHi(): string {
          return 'hi there';
        }

        export function libASayHello(): string {
          return 'Hi from tslib-a';
        }
        `
        );

        createFile(
          `libs/${libA}/src/lib/some-non-exported-function.ts`,
          `
        export function someNonPublicLibFunction() {
          return 'this function is exported, but not via the libs barrel file';
        }

        export function someSelectivelyExportedFn() {
          return 'this fn is exported selectively in the barrel file';
        }
        `
        );

        createFile(
          `libs/${libA}/src/index.ts`,
          `
        export * from './lib/tslib-a';

        export { someSelectivelyExportedFn } from './lib/some-non-exported-function';
        `
        );

        /**
         * create tslib-b structure
         */
        createFile(
          `libs/${libB}/src/index.ts`,
          `
        export * from './lib/tslib-b';
        `
        );

        createFile(
          `libs/${libB}/src/lib/tslib-b.ts`,
          `
          import { libASayHi } from 'libs/${libA}/src/lib/tslib-a';
          import { libASayHello } from '../../../${libA}/src/lib/tslib-a';
          // import { someNonPublicLibFunction } from '../../../${libA}/src/lib/some-non-exported-function';
          import { someSelectivelyExportedFn } from '../../../${libA}/src/lib/some-non-exported-function';

          export function tslibB(): string {
            // someNonPublicLibFunction();
            someSelectivelyExportedFn();
            libASayHi();
            libASayHello();
            return 'hi there';
          }
        `
        );

        /**
         * create tslib-c structure
         */

        createFile(
          `libs/${libC}/src/index.ts`,
          `
        export * from './lib/tslib-c';
        export * from './lib/constant';

        `
        );

        createFile(
          `libs/${libC}/src/lib/constant.ts`,
          `
        export const SOME_CONSTANT = 'some constant value';
        export const someFunc1 = () => 'hi';
        export function someFunc2() {
          return 'hi2';
        }
        `
        );

        createFile(
          `libs/${libC}/src/lib/tslib-c-another.ts`,
          `
  import { tslibC, SOME_CONSTANT, someFunc1, someFunc2 } from '@${projScope}/${libC}';

  export function someStuff() {
    someFunc1();
    someFunc2();
    tslibC();
    console.log(SOME_CONSTANT);
    return 'hi';
  }

        `
        );

        createFile(
          `libs/${libC}/src/lib/tslib-c.ts`,
          `
  import { someFunc1, someFunc2, SOME_CONSTANT } from '@${projScope}/${libC}';

  export function tslibC(): string {
    someFunc1();
    someFunc2();
    console.log(SOME_CONSTANT);
    return 'tslib-c';
  }

        `
        );
      });

      it('should fix noSelfCircularDependencies', () => {
        const stdout = runCLI(`lint ${libC}`, {
          silenceError: true,
        });
        expect(stdout).toContain(
          'Projects should use relative imports to import from other files within the same project'
        );

        // fix them
        const fixedStout = runCLI(`lint ${libC} --fix`, {
          silenceError: true,
        });
        expect(fixedStout).toContain(
          `Successfully ran target lint for project ${libC}`
        );

        const fileContent = readFile(`libs/${libC}/src/lib/tslib-c-another.ts`);
        expect(fileContent).toContain(`import { tslibC } from './tslib-c';`);
        expect(fileContent).toContain(
          `import { SOME_CONSTANT, someFunc1, someFunc2 } from './constant';`
        );

        const fileContentTslibC = readFile(`libs/${libC}/src/lib/tslib-c.ts`);
        expect(fileContentTslibC).toContain(
          `import { someFunc1, someFunc2, SOME_CONSTANT } from './constant';`
        );
      });

      it('should fix noRelativeOrAbsoluteImportsAcrossLibraries', () => {
        const stdout = runCLI(`lint ${libB}`, {
          silenceError: true,
        });
        expect(stdout).toContain(
          'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope'
        );

        // fix them
        const fixedStout = runCLI(`lint ${libB} --fix`, {
          silenceError: true,
        });
        expect(fixedStout).toContain(
          `Successfully ran target lint for project ${libB}`
        );

        const fileContent = readFile(`libs/${libB}/src/lib/tslib-b.ts`);
        expect(fileContent).toContain(
          `import { libASayHello } from '@${projScope}/${libA}';`
        );
        expect(fileContent).toContain(
          `import { libASayHi } from '@${projScope}/${libA}';`
        );
        expect(fileContent).toContain(
          `import { someSelectivelyExportedFn } from '@${projScope}/${libA}';`
        );
      });
    });

    describe('dependency checks', () => {
      beforeAll(() => {
        updateJson(`libs/${mylib}/.eslintrc.json`, (json) => {
          if (!json.overrides.some((o) => o.rules?.['@nx/dependency-checks'])) {
            json.overrides = [
              ...json.overrides,
              {
                files: ['*.json'],
                parser: 'jsonc-eslint-parser',
                rules: {
                  '@nx/dependency-checks': 'error',
                },
              },
            ];
          }
          return json;
        });
      });

      afterAll(() => {
        // ensure the rule for dependency checks is removed
        // so that it does not affect other tests
        updateJson(`libs/${mylib}/.eslintrc.json`, (json) => {
          json.overrides = json.overrides.filter(
            (o) => !o.rules?.['@nx/dependency-checks']
          );
          return json;
        });
      });

      it('should report dependency check issues', () => {
        const rootPackageJson = readJson('package.json');
        const nxVersion = rootPackageJson.devDependencies.nx;
        const tslibVersion = rootPackageJson.dependencies['tslib'];

        let out = runCLI(`lint ${mylib}`, { silenceError: true });
        expect(out).toContain('Successfully ran target lint');

        // make an explict dependency to nx
        updateFile(
          `libs/${mylib}/src/lib/${mylib}.ts`,
          (content) =>
            `import { names } from '@nx/devkit';\n\n` +
            content.replace(/=> .*;/, `=> names('${mylib}').className;`)
        );

        // output should now report missing dependency
        out = runCLI(`lint ${mylib}`, { silenceError: true });
        expect(out).toContain('they are missing');
        expect(out).toContain('@nx/devkit');

        // should fix the missing dependency issue
        out = runCLI(`lint ${mylib} --fix`, { silenceError: true });
        expect(out).toContain(
          `Successfully ran target lint for project ${mylib}`
        );
        const packageJson = readJson(`libs/${mylib}/package.json`);
        expect(packageJson).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "@nx/devkit": "${nxVersion}",
              "tslib": "${tslibVersion}",
            },
            "main": "./src/index.js",
            "name": "@proj/${mylib}",
            "private": true,
            "type": "commonjs",
            "typings": "./src/index.d.ts",
            "version": "0.0.1",
          }
        `);

        // intentionally set the invalid version
        updateJson(`libs/${mylib}/package.json`, (json) => {
          json.dependencies['@nx/devkit'] = '100.0.0';
          return json;
        });
        out = runCLI(`lint ${mylib}`, { silenceError: true });
        expect(out).toContain(
          'version specifier does not contain the installed version of "@nx/devkit"'
        );

        // should fix the version mismatch issue
        out = runCLI(`lint ${mylib} --fix`, { silenceError: true });
        expect(out).toContain(
          `Successfully ran target lint for project ${mylib}`
        );
      });
    });

    describe('flat config', () => {
      beforeAll(() => {
        runCLI(`generate @nx/eslint:convert-to-flat-config`);
      });

      it('should generate new projects using flat config', () => {
        const reactLib = uniq('react-lib');
        const jsLib = uniq('js-lib');

        runCLI(
          `generate @nx/react:lib ${reactLib} --directory=${reactLib} --projectNameAndRootFormat=as-provided`
        );
        runCLI(
          `generate @nx/js:lib ${jsLib} --directory=${jsLib} --projectNameAndRootFormat=as-provided`
        );

        checkFilesExist(
          `${reactLib}/eslint.config.js`,
          `${jsLib}/eslint.config.js`
        );
        checkFilesDoNotExist(
          `${reactLib}/.eslintrc.json`,
          `${jsLib}/.eslintrc.json`
        );

        // validate that the new projects are linted successfully
        let output = runCLI(`lint ${reactLib}`);
        expect(output).toContain(
          `Successfully ran target lint for project ${reactLib}`
        );
        output = runCLI(`lint ${jsLib}`);
        expect(output).toContain(
          `Successfully ran target lint for project ${jsLib}`
        );
      });
    });
  });

  describe('Root projects migration', () => {
    beforeEach(() =>
      newProject({
        packages: ['@nx/react', '@nx/js', '@nx/angular', '@nx/node'],
      })
    );
    afterEach(() => cleanupProject());

    function verifySuccessfulStandaloneSetup(myapp: string) {
      expect(runCLI(`lint ${myapp}`, { silenceError: true })).toContain(
        'Successfully ran target lint'
      );
      expect(runCLI(`lint e2e`, { silenceError: true })).toContain(
        'Successfully ran target lint'
      );
      expect(() => checkFilesExist(`.eslintrc.base.json`)).toThrow();

      const rootEslint = readJson('.eslintrc.json');
      const e2eEslint = readJson('e2e/.eslintrc.json');

      // should directly refer to nx plugin
      expect(rootEslint.plugins).toEqual(['@nx']);
      expect(e2eEslint.plugins).toEqual(['@nx']);
    }

    function verifySuccessfulMigratedSetup(myapp: string, mylib: string) {
      expect(runCLI(`lint ${myapp}`, { silenceError: true })).toContain(
        'Successfully ran target lint'
      );
      expect(runCLI(`lint e2e`, { silenceError: true })).toContain(
        'Successfully ran target lint'
      );
      expect(runCLI(`lint ${mylib}`, { silenceError: true })).toContain(
        'Successfully ran target lint'
      );
      expect(() => checkFilesExist(`.eslintrc.base.json`)).not.toThrow();

      const rootEslint = readJson('.eslintrc.base.json');
      const appEslint = readJson('.eslintrc.json');
      const e2eEslint = readJson('e2e/.eslintrc.json');
      const libEslint = readJson(`libs/${mylib}/.eslintrc.json`);

      // should directly refer to nx plugin
      expect(rootEslint.plugins).toEqual(['@nx']);
      expect(appEslint.plugins).toBeUndefined();
      expect(e2eEslint.plugins).toBeUndefined();
      expect(libEslint.plugins).toBeUndefined();

      // should extend base
      expect(appEslint.extends.slice(-1)).toEqual(['./.eslintrc.base.json']);
      expect(e2eEslint.extends.slice(-1)).toEqual(['../.eslintrc.base.json']);
      expect(libEslint.extends.slice(-1)).toEqual([
        '../../.eslintrc.base.json',
      ]);
    }

    it('(React standalone) should set root project config to app and e2e app and migrate when another lib is added', () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');

      runCLI(`generate @nx/react:app ${myapp} --rootProject=true`);
      verifySuccessfulStandaloneSetup(myapp);

      let appEslint = readJson('.eslintrc.json');
      let e2eEslint = readJson('e2e/.eslintrc.json');

      // should have plugin extends
      let appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).toContain('plugin:@nx/javascript');
      expect(appOverrides).toContain('plugin:@nx/typescript');
      let e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).toContain('plugin:@nx/javascript');

      runCLI(`generate @nx/js:lib ${mylib} --unitTestRunner=jest`);
      verifySuccessfulMigratedSetup(myapp, mylib);

      appEslint = readJson(`.eslintrc.json`);
      e2eEslint = readJson('e2e/.eslintrc.json');

      // should have no plugin extends
      appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).not.toContain('plugin:@nx/javascript');
      expect(appOverrides).not.toContain('plugin:@nx/typescript');
      e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).not.toContain('plugin:@nx/javascript');
      expect(e2eOverrides).not.toContain('plugin:@nx/typescript');
    });

    it('(Angular standalone) should set root project config to app and e2e app and migrate when another lib is added', () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');

      runCLI(
        `generate @nx/angular:app ${myapp} --rootProject=true --no-interactive`
      );
      verifySuccessfulStandaloneSetup(myapp);

      let appEslint = readJson('.eslintrc.json');
      let e2eEslint = readJson('e2e/.eslintrc.json');

      // should have plugin extends
      let appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).toContain('plugin:@nx/typescript');
      let e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).toContain('plugin:@nx/javascript');

      runCLI(`generate @nx/js:lib ${mylib} --no-interactive`);
      verifySuccessfulMigratedSetup(myapp, mylib);

      appEslint = readJson(`.eslintrc.json`);
      e2eEslint = readJson('e2e/.eslintrc.json');

      // should have no plugin extends
      appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).not.toContain('plugin:@nx/typescript');
      e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).not.toContain('plugin:@nx/typescript');
    });

    it('(Node standalone) should set root project config to app and e2e app and migrate when another lib is added', async () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');

      runCLI(
        `generate @nx/node:app ${myapp} --rootProject=true --no-interactive`
      );
      verifySuccessfulStandaloneSetup(myapp);

      let appEslint = readJson('.eslintrc.json');
      let e2eEslint = readJson('e2e/.eslintrc.json');

      // should have plugin extends
      let appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).toContain('plugin:@nx/javascript');
      expect(appOverrides).toContain('plugin:@nx/typescript');
      let e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).toContain('plugin:@nx/javascript');
      expect(e2eOverrides).toContain('plugin:@nx/typescript');

      runCLI(`generate @nx/js:lib ${mylib} --no-interactive`);
      verifySuccessfulMigratedSetup(myapp, mylib);

      appEslint = readJson(`.eslintrc.json`);
      e2eEslint = readJson('e2e/.eslintrc.json');

      // should have no plugin extends
      // should have no plugin extends
      appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).not.toContain('plugin:@nx/javascript');
      expect(appOverrides).not.toContain('plugin:@nx/typescript');
      e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).not.toContain('plugin:@nx/javascript');
      expect(e2eOverrides).not.toContain('plugin:@nx/typescript');
    });
  });
});

/**
 * Update the generated rule implementation to produce a known lint error from all files.
 *
 * It is important that we do this surgically via AST transformations, otherwise we will
 * drift further and further away from the original generated code and therefore make our
 * e2e test less accurate and less valuable.
 */
function updateGeneratedRuleImplementation(
  newRulePath: string,
  newRuleGeneratedContents: string,
  knownLintErrorMessage: string,
  messageId,
  libMethodName: string,
  libPath: string
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newRuleSourceFile = ts.createSourceFile(
    newRulePath,
    newRuleGeneratedContents,
    ts.ScriptTarget.Latest,
    true
  );

  const transformer = <T extends ts.SourceFile>(
    context: ts.TransformationContext
  ) =>
    ((rootNode: T) => {
      function visit(node: ts.Node): ts.Node {
        /**
         * Add an ESLint messageId which will show the knownLintErrorMessage
         *
         * i.e.
         *
         * messages: {
         *   e2eMessageId: knownLintErrorMessage
         * }
         */
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.name) &&
          node.name.escapedText === 'messages'
        ) {
          return ts.factory.updatePropertyAssignment(
            node,
            node.name,
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                messageId,
                ts.factory.createStringLiteral(knownLintErrorMessage)
              ),
            ])
          );
        }

        /**
         * Update the rule implementation to report the knownLintErrorMessage on every Program node
         *
         * During the debugging of the switch from ts-node to swc-node we found out
         * that regular rules would work even without explicit path mapping registration,
         * but rules that import runtime functionality from within the workspace
         * would break the rule registration.
         *
         * Instead of having a static literal messageId we retreieved it via imported getMessageId method.
         *
         * i.e.
         *
         * create(context) {
         *    return  {
         *      Program(node) {
         *        context.report({
         *          messageId: getMessageId(),
         *          node,
         *        });
         *      }
         *    }
         *  }
         */
        if (
          ts.isMethodDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.escapedText === 'create'
        ) {
          return ts.factory.updateMethodDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            node.parameters,
            node.type,
            ts.factory.createBlock([
              ts.factory.createReturnStatement(
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createMethodDeclaration(
                    [],
                    undefined,
                    'Program',
                    undefined,
                    [],
                    [
                      ts.factory.createParameterDeclaration(
                        [],
                        undefined,
                        'node',
                        undefined,
                        undefined,
                        undefined
                      ),
                    ],
                    undefined,
                    ts.factory.createBlock([
                      ts.factory.createExpressionStatement(
                        ts.factory.createCallExpression(
                          ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier('context'),
                            'report'
                          ),
                          [],
                          [
                            ts.factory.createObjectLiteralExpression([
                              ts.factory.createPropertyAssignment(
                                'messageId',
                                ts.factory.createCallExpression(
                                  ts.factory.createIdentifier(libMethodName),
                                  [],
                                  []
                                )
                              ),
                              ts.factory.createShorthandPropertyAssignment(
                                'node'
                              ),
                            ]),
                          ]
                        )
                      ),
                    ])
                  ),
                ])
              ),
            ])
          );
        }

        return ts.visitEachChild(node, visit, context);
      }

      /**
       * Add lib import as a first line of the rule file.
       * Needed for the access of getMessageId in the context report above.
       *
       * i.e.
       *
       * import { getMessageId } from "@myproj/mylib";
       *
       */
      const importAdded = ts.factory.updateSourceFile(rootNode, [
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier(libMethodName)
              ),
            ])
          ),
          ts.factory.createStringLiteral(libPath)
        ),
        ...rootNode.statements,
      ]);
      return ts.visitNode(importAdded, visit);
    }) as ts.Transformer<T>;

  const result: ts.TransformationResult<ts.SourceFile> =
    ts.transform<ts.SourceFile>(newRuleSourceFile, [transformer]);
  const updatedSourceFile: ts.SourceFile = result.transformed[0];

  return printer.printFile(updatedSourceFile);
}

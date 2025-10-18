import { createFile, readFile, runCLI, uniq } from '@nx/e2e-utils';
import {
  setupLinterIntegratedTest,
  cleanupLinterIntegratedTest,
  LinterIntegratedTestContext,
} from './linter-setup';

describe('Linter', () => {
  let originalEslintUseFlatConfigVal: string | undefined;
  beforeAll(() => {
    // Opt into legacy .eslintrc config format for these tests
    originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
  });
  afterAll(() => {
    process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
  });

  describe('Integrated', () => {
    let context: LinterIntegratedTestContext;

    beforeAll(() => {
      context = setupLinterIntegratedTest();
    });
    afterAll(() => cleanupLinterIntegratedTest());

    describe('workspace boundary rules', () => {
      const libA = uniq('tslib-a');
      const libB = uniq('tslib-b');
      const libC = uniq('tslib-c');

      beforeAll(() => {
        const { projScope } = context;
        // make these libs non-buildable to avoid dep-checks triggering lint errors
        runCLI(
          `generate @nx/js:lib libs/${libA} --bundler=none --linter eslint`
        );
        runCLI(
          `generate @nx/js:lib libs/${libB} --bundler=none --linter eslint`
        );
        runCLI(
          `generate @nx/js:lib libs/${libC} --bundler=none --linter eslint`
        );

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
          env: { CI: 'false' },
        });
        expect(stdout).toContain(
          'Projects should use relative imports to import from other files within the same project'
        );

        // fix them
        const fixedStout = runCLI(`lint ${libC} --fix`, {
          silenceError: true,
          env: { CI: 'false' },
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
        const { projScope } = context;
        const stdout = runCLI(`lint ${libB}`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(stdout).toContain(
          'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope'
        );

        // fix them
        const fixedStout = runCLI(`lint ${libB} --fix`, {
          silenceError: true,
          env: { CI: 'false' },
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
  });
});

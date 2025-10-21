import { readJson, runCLI, uniq, updateFile } from '@nx/e2e-utils';
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

    describe('linting errors', () => {
      it('lint plugin should ensure module boundaries', () => {
        const { myapp, projScope } = context;
        const myapp2 = uniq('myapp2');
        const lazylib = uniq('lazylib');
        const invalidtaglib = uniq('invalidtaglib');
        const validtaglib = uniq('validtaglib');

        runCLI(`generate @nx/react:app apps/${myapp2} --linter eslint`);
        runCLI(`generate @nx/react:lib libs/${lazylib} --linter eslint`);
        runCLI(
          `generate @nx/js:lib libs/${invalidtaglib} --linter eslint --tags=invalidtag`
        );
        runCLI(
          `generate @nx/js:lib libs/${validtaglib} --linter eslint --tags=validtag`
        );

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
        import '../../../libs/${context.mylib}';
        import '@secondScope/${lazylib}';
        import '@${projScope}/${myapp2}';
        import '@${projScope}/${invalidtaglib}';
        import '@${projScope}/${validtaglib}';

        const s = {loadChildren: '@secondScope/${lazylib}'};
      `
        );

        const out = runCLI(`lint ${myapp}`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain(
          'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope'
        );
        expect(out).toContain('Imports of apps are forbidden');
        expect(out).toContain(
          'A project tagged with "validtag" can only depend on libs tagged with "validtag"'
        );
      }, 1000000);
    });
  });
});

import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  uniq,
} from '@nx/e2e-utils';
import {
  setupLinterIntegratedTest,
  cleanupLinterIntegratedTest,
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
    beforeAll(() => {
      setupLinterIntegratedTest();
    });
    afterAll(() => cleanupLinterIntegratedTest());

    describe('flat config', () => {
      let envVar: string | undefined;
      beforeAll(() => {
        runCLI(`generate @nx/eslint:convert-to-flat-config`);
        envVar = process.env.ESLINT_USE_FLAT_CONFIG;
        // Now that we have converted the existing configs to flat config we need to clear the explicitly set env var to allow it to infer things from the root config file type
        delete process.env.ESLINT_USE_FLAT_CONFIG;
      });
      afterAll(() => {
        process.env.ESLINT_USE_FLAT_CONFIG = envVar;
      });

      it('should generate new projects using flat config', () => {
        const reactLib = uniq('react-lib');
        const jsLib = uniq('js-lib');

        runCLI(`generate @nx/react:lib ${reactLib} --linter eslint`);
        runCLI(`generate @nx/js:lib ${jsLib} --linter eslint`);

        checkFilesExist(
          `${reactLib}/eslint.config.mjs`,
          `${jsLib}/eslint.config.mjs`
        );
        checkFilesDoNotExist(
          `${reactLib}/.eslintrc.json`,
          `${jsLib}/.eslintrc.json`
        );

        // validate that the new projects are linted successfully
        expect(() =>
          runCLI(`lint ${reactLib}`, {
            env: { CI: 'false' },
          })
        ).not.toThrow();
        expect(() =>
          runCLI(`lint ${jsLib}`, {
            env: { CI: 'false' },
          })
        ).not.toThrow();
      });
    });
  });
});

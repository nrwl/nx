import { readJson, runCLI, updateFile, updateJson } from '@nx/e2e-utils';
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

    describe('dependency checks', () => {
      beforeAll(() => {
        const { mylib } = context;
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
        const { mylib } = context;
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
        const { mylib } = context;
        const rootPackageJson = readJson('package.json');
        const nxVersion = rootPackageJson.devDependencies.nx;
        const tslibVersion =
          rootPackageJson.dependencies['tslib'] ||
          rootPackageJson.devDependencies['tslib'];

        let out = runCLI(`lint ${mylib} --skip-nx-cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain('Successfully ran target lint');

        // make an explict dependency to nx
        updateFile(
          `libs/${mylib}/src/lib/${mylib}.ts`,
          (content) =>
            `import { names } from '@nx/devkit';\n\n` +
            content.replace(/=> .*;/, `=> names('${mylib}').className;`)
        );
        // intentionally set an obsolete dependency
        updateJson(`libs/${mylib}/package.json`, (json) => {
          json.dependencies['@nx/js'] = nxVersion;
          return json;
        });

        // output should now report missing dependency and obsolete dependency
        out = runCLI(`lint ${mylib} --skip-nx-cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain('they are missing');
        expect(out).toContain('@nx/devkit');
        expect(out).toContain(
          `The "@nx/js" package is not used by "${mylib}" project`
        );

        // should fix the missing and obsolete dependency issues
        out = runCLI(`lint ${mylib} --fix --skip-nx-cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain(
          `Successfully ran target lint for project ${mylib}`
        );
        const packageJson = readJson(`libs/${mylib}/package.json`);
        expect(packageJson).toMatchObject({
          dependencies: {
            '@nx/devkit': nxVersion,
            tslib: tslibVersion,
          },
          main: './src/index.js',
          name: `@proj/${mylib}`,
          private: true,
          type: 'commonjs',
          types: './src/index.d.ts',
          version: '0.0.1',
        });

        // intentionally set the invalid version
        updateJson(`libs/${mylib}/package.json`, (json) => {
          json.dependencies['@nx/devkit'] = '100.0.0';
          return json;
        });
        out = runCLI(`lint ${mylib} --skip-nx-cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain(
          'version specifier does not contain the installed version of "@nx/devkit"'
        );

        // should fix the version mismatch issue
        out = runCLI(`lint ${mylib} --fix --skip-nx-cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain(
          `Successfully ran target lint for project ${mylib}`
        );
      });
    });
  });
});

import { checkFilesExist, readJson, runCLI, uniq } from '@nx/e2e-utils';
import {
  setupLinterRootProjectsTest,
  cleanupLinterRootProjectsTest,
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

  describe('Root projects migration', () => {
    beforeEach(() => setupLinterRootProjectsTest());
    afterEach(() => cleanupLinterRootProjectsTest());

    function verifySuccessfulStandaloneSetup(myapp: string) {
      expect(
        runCLI(`lint ${myapp}`, { silenceError: true, env: { CI: 'false' } })
      ).toContain('Successfully ran target lint');
      expect(
        runCLI(`lint e2e`, { silenceError: true, env: { CI: 'false' } })
      ).toContain('Successfully ran target lint');
      expect(() => checkFilesExist(`.eslintrc.base.json`)).toThrow();

      const rootEslint = readJson('.eslintrc.json');
      const e2eEslint = readJson('e2e/.eslintrc.json');

      // should directly refer to nx plugin
      expect(rootEslint.plugins).toEqual(['@nx']);
      expect(e2eEslint.plugins).toEqual(['@nx']);
    }

    function verifySuccessfulMigratedSetup(myapp: string, mylib: string) {
      expect(
        runCLI(`lint ${myapp}`, { silenceError: true, env: { CI: 'false' } })
      ).toContain('Successfully ran target lint');
      expect(
        runCLI(`lint e2e`, { silenceError: true, env: { CI: 'false' } })
      ).toContain('Successfully ran target lint');
      expect(
        runCLI(`lint ${mylib}`, { silenceError: true, env: { CI: 'false' } })
      ).toContain('Successfully ran target lint');
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

      runCLI(
        `generate @nx/react:app --name=${myapp} --unitTestRunner=jest --linter eslint --directory="."`
      );
      runCLI('reset', { env: { CI: 'false' } });
      verifySuccessfulStandaloneSetup(myapp);

      let appEslint = readJson('.eslintrc.json');
      let e2eEslint = readJson('e2e/.eslintrc.json');

      // should have plugin extends
      let appOverrides = JSON.stringify(appEslint.overrides);
      expect(appOverrides).toContain('plugin:@nx/javascript');
      expect(appOverrides).toContain('plugin:@nx/typescript');
      let e2eOverrides = JSON.stringify(e2eEslint.overrides);
      expect(e2eOverrides).toContain('plugin:@nx/javascript');

      runCLI(
        `generate @nx/js:lib libs/${mylib} --unitTestRunner=jest --linter eslint`
      );
      runCLI('reset', { env: { CI: 'false' } });
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
  });
});

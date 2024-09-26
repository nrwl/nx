import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  readFile,
  readJson,
  renameFile,
  runCLI,
  runCreateWorkspace,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Linter (legacy)', () => {
  describe('Integrated (eslintrc config)', () => {
    let originalEslintUseFlatConfigVal: string | undefined;
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    beforeAll(() => {
      // Opt into legacy .eslintrc config format for these tests
      originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';

      newProject({
        packages: ['@nx/react', '@nx/js', '@nx/eslint'],
      });
      runCLI(`generate @nx/react:app apps/${myapp} --tags=validtag`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });
      runCLI(`generate @nx/js:lib apps/${mylib}`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });
    });
    afterAll(() => {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
      cleanupProject();
    });

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

        // 1. linting should error when rules are not followed
        expect(() => runCLI(`lint ${myapp}`)).toThrow();

        // 2. linting should not error when rules are not followed and the force flag is specified
        expect(() => runCLI(`lint ${myapp} --force`)).not.toThrow();

        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = undefined;
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        // 3. linting should not error when all rules are followed
        expect(() =>
          runCLI(`lint ${myapp}`, { silenceError: true })
        ).not.toThrow();
      }, 1000000);

      it('should print the effective configuration for a file specified using --print-config', () => {
        const eslint = readJson('.eslintrc.json');
        eslint.overrides.push({
          files: ['src/index.ts'],
          rules: {
            'specific-rule': 'off',
          },
        });
        updateFile('.eslintrc.json', JSON.stringify(eslint, null, 2));
        const out = runCLI(`lint ${myapp} --print-config src/index.ts`, {
          env: { CI: 'false' }, // We don't want to show the summary table from cloud runner
          silenceError: true,
        });
        expect(out).toContain('"specific-rule": [');
      }, 1000000);
    });
  });

  describe('eslintrc convert to flat config', () => {
    let originalEslintUseFlatConfigVal: string | undefined;
    const packageManager = getSelectedPackageManager() || 'pnpm';

    beforeAll(() => {
      // Opt into legacy .eslintrc config format for these tests
      originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    });
    afterAll(() => {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    beforeEach(() => {
      process.env.NX_ADD_PLUGINS = 'false';
    });

    afterEach(() => {
      delete process.env.NX_ADD_PLUGINS;
      cleanupProject();
    });

    it('should convert integrated to flat config', () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');

      runCreateWorkspace(myapp, {
        preset: 'react-monorepo',
        appName: myapp,
        style: 'css',
        packageManager,
        bundler: 'vite',
        e2eTestRunner: 'none',
      });
      runCLI(`generate @nx/js:lib libs/${mylib}`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });
      runCLI(`generate @nx/js:lib libs/${mylib2}`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });

      // migrate to flat structure
      runCLI(`generate @nx/eslint:convert-to-flat-config`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });
      checkFilesExist(
        'eslint.config.js',
        `apps/${myapp}/eslint.config.js`,
        `libs/${mylib}/eslint.config.js`,
        `libs/${mylib2}/eslint.config.js`
      );
      checkFilesDoNotExist(
        '.eslintrc.json',
        `apps/${myapp}/.eslintrc.json`,
        `libs/${mylib}/.eslintrc.json`,
        `libs/${mylib2}/.eslintrc.json`
      );

      // move eslint.config one step up
      // to test the absence of the flat eslint config in the project root folder
      renameFile(`libs/${mylib2}/eslint.config.js`, `libs/eslint.config.js`);
      updateFile(
        `libs/eslint.config.js`,
        readFile(`libs/eslint.config.js`).replace(
          `../../eslint.config.js`,
          `../eslint.config.js`
        )
      );

      const outFlat = runCLI(`affected -t lint`, {
        silenceError: true,
      });
      expect(outFlat).toContain(`${myapp}:lint`);
      expect(outFlat).toContain(`${mylib}:lint`);
      expect(outFlat).toContain(`${mylib2}:lint`);
    }, 1000000);

    it('should convert standalone to flat config', () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');

      runCreateWorkspace(myapp, {
        preset: 'react-standalone',
        appName: myapp,
        style: 'css',
        packageManager,
        bundler: 'vite',
        e2eTestRunner: 'none',
      });
      runCLI(`generate @nx/js:lib ${mylib}`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });

      // migrate to flat structure
      runCLI(`generate @nx/eslint:convert-to-flat-config`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });
      checkFilesExist(
        'eslint.config.js',
        `${mylib}/eslint.config.js`,
        'eslint.base.config.js'
      );
      checkFilesDoNotExist(
        '.eslintrc.json',
        `${mylib}/.eslintrc.json`,
        '.eslintrc.base.json'
      );

      const outFlat = runCLI(`affected -t lint`, {
        silenceError: true,
      });
      expect(outFlat).toContain(`${myapp}:lint`);
      expect(outFlat).toContain(`${mylib}:lint`);
    }, 1000000);
  });
});

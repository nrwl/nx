import * as path from 'path';
import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Linter', () => {
  it('linting should error when rules are not followed', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = 'error';
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    const out = runCLI(`lint ${myapp}`, { silenceError: true });
    expect(out).toContain('Unexpected console statement');
  }, 1000000);

  it('linting should not error when rules are not followed and the force flag is specified', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = 'error';
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    expect(() => runCLI(`lint ${myapp} --force`)).not.toThrow();
  }, 1000000);

  it('linting should not error when all rules are followed', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = undefined;
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    const out = runCLI(`lint ${myapp}`, { silenceError: true });
    expect(out).toContain('All files pass linting');
  }, 1000000);

  it('linting should error when an invalid linter is specified', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    // This test is only relevant for the deprecated lint builder,
    // so we need to patch the workspace.json to use it
    const workspaceJson = readJson(`workspace.json`);
    workspaceJson.projects[myapp].targets.lint = {
      executor: '@nrwl/linter:lint',
      options: {
        linter: 'eslint',
        tsConfig: [
          `apps/${myapp}/tsconfig.app.json`,
          `apps/${myapp}/tsconfig.spec.json`,
        ],
        exclude: ['**/node_modules/**', `!apps/${myapp}/**/*`],
      },
    };
    updateFile('workspace.json', JSON.stringify(workspaceJson, null, 2));

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = undefined;
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    expect(() => runCLI(`lint ${myapp} --linter=tslint`)).toThrow(
      /'tslint' option is no longer supported/
    );
    expect(() => runCLI(`lint ${myapp} --linter=random`)).toThrow(
      /'random' should be one of eslint,tslint/
    );
  }, 1000000);

  describe('linting with --cache', () => {
    function readCacheFile(cacheFile = '.eslintcache') {
      const cacheInfo = readFile(cacheFile);
      return process.platform === 'win32'
        ? cacheInfo.replace(/\\\\/g, '\\')
        : cacheInfo;
    }

    it('should generate a default cache file', () => {
      newProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      expect(() => checkFilesExist(`.eslintcache`)).toThrow();
      runCLI(`lint ${myapp} --cache`, { silenceError: true });
      expect(() => checkFilesExist(`.eslintcache`)).not.toThrow();
      const cacheInfo = readCacheFile();
      expect(cacheInfo).toContain(
        path.normalize(`${myapp}/src/app/app.spec.tsx`)
      );
    }, 1000000);

    it('should let you specify a cache file location', () => {
      newProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      expect(() => checkFilesExist(`my-cache`)).toThrow();
      runCLI(`lint ${myapp} --cache --cache-location="my-cache"`, {
        silenceError: true,
      });
      expect(() => checkFilesExist(`my-cache`)).not.toThrow();
      const cacheInfo = readCacheFile('my-cache');
      expect(cacheInfo).toContain(
        path.normalize(`${myapp}/src/app/app.spec.tsx`)
      );
    }, 1000000);
  });

  it('linting should generate an output file with a specific format', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = 'error';
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));
    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    const outputFile = 'a/b/c/lint-output.json';
    expect(() => {
      checkFilesExist(outputFile);
    }).toThrow();
    const stdout = runCLI(
      `lint ${myapp} --output-file="${outputFile}" --format=json`,
      {
        silenceError: true,
      }
    );
    expect(stdout).not.toContain('Unexpected console statement');
    expect(() => checkFilesExist(outputFile)).not.toThrow();
    const outputContents = JSON.parse(readFile(outputFile));
    const outputForApp: any = Object.values(
      outputContents
    ).filter((result: any) =>
      result.filePath.includes(path.normalize(`${myapp}/src/main.ts`))
    )[0];
    expect(outputForApp.errorCount).toBe(1);
    expect(outputForApp.messages[0].ruleId).toBe('no-console');
    expect(outputForApp.messages[0].message).toBe(
      'Unexpected console statement.'
    );
  }, 1000000);
});

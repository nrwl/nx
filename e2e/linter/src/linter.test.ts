import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  updateFile,
  ensureProject,
  uniq,
  forEachCli,
} from '@nrwl/e2e/utils';

forEachCli('nx', () => {
  describe('Linter', () => {
    it('linting should error when rules are not followed', () => {
      ensureProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      const eslintrc = readJson('.eslintrc');
      eslintrc.rules['no-console'] = 'error';
      updateFile('.eslintrc', JSON.stringify(eslintrc, null, 2));

      updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

      const out = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(out).toContain('Unexpected console statement');
    }, 1000000);

    it('linting should not error when rules are not followed and the force flag is specified', () => {
      ensureProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      const eslintrc = readJson('.eslintrc');
      eslintrc.rules['no-console'] = 'error';
      updateFile('.eslintrc', JSON.stringify(eslintrc, null, 2));

      updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

      expect(() => runCLI(`lint ${myapp} --force`)).not.toThrow();
    }, 1000000);

    it('linting should not error when all rules are followed', () => {
      ensureProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      const eslintrc = readJson('.eslintrc');
      eslintrc.rules['no-console'] = undefined;
      updateFile('.eslintrc', JSON.stringify(eslintrc, null, 2));

      updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

      const out = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(out).toContain('All files pass linting');
    }, 1000000);

    it('linting should error when an invalid linter is specified', () => {
      ensureProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      const eslintrc = readJson('.eslintrc');
      eslintrc.rules['no-console'] = undefined;
      updateFile('.eslintrc', JSON.stringify(eslintrc, null, 2));

      updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

      expect(() => runCLI(`lint ${myapp} --linter=tslint`)).toThrow(
        /'tslint' option is no longer supported/
      );
      expect(() => runCLI(`lint ${myapp} --linter=random`)).toThrow(
        /Schema validation failed/
      );
    }, 1000000);

    it('linting should generate a default cache file', () => {
      newProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      expect(() => checkFilesExist(`.eslintcache`)).toThrow();
      runCLI(`lint ${myapp} --cache`, { silenceError: true });
      expect(() => checkFilesExist(`.eslintcache`)).not.toThrow();
      const cacheInfo = readFile('.eslintcache');
      expect(cacheInfo).toContain(`${myapp}/src/app/app.spec.tsx`);
    }, 1000000);

    it('linting should let you specify a cache file location', () => {
      newProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      expect(() => checkFilesExist(`my-cache`)).toThrow();
      runCLI(`lint ${myapp} --cache --cache-location="my-cache"`, {
        silenceError: true,
      });
      expect(() => checkFilesExist(`my-cache`)).not.toThrow();
      const cacheInfo = readFile('my-cache');
      expect(cacheInfo).toContain(`${myapp}/src/app/app.spec.tsx`);
    }, 1000000);

    it('linting should generate an output file with a specific format', () => {
      newProject();
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/react:app ${myapp}`);

      const eslintrc = readJson('.eslintrc');
      eslintrc.rules['no-console'] = 'error';
      updateFile('.eslintrc', JSON.stringify(eslintrc, null, 2));
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
      expect(stdout).toContain('Unexpected console statement');
      expect(() => checkFilesExist(outputFile)).not.toThrow();
      const outputContents = JSON.parse(readFile(outputFile));
      const outputForApp: any = Object.values(
        outputContents
      ).filter((result: any) =>
        result.filePath.includes(`${myapp}/src/main.ts`)
      )[0];
      expect(outputForApp.errorCount).toBe(1);
      expect(outputForApp.messages[0].ruleId).toBe('no-console');
      expect(outputForApp.messages[0].message).toBe(
        'Unexpected console statement.'
      );
    }, 1000000);
  });

  // bad test. fix and reenable
  xit('supports warning options', () => {
    newProject();
    const myapp = uniq('myapp');

    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson(`apps/${myapp}/.eslintrc`);
    eslintrc.rules['no-console'] = 'warn';
    updateFile(`apps/${myapp}/.eslintrc`, JSON.stringify(eslintrc, null, 2));
    updateFile(
      `apps/${myapp}/src/main.ts`,
      `console.log('once'); console.log('twice');`
    );

    let output = runCLI(`lint ${myapp}`, { silenceError: true });
    expect(output).toMatch(/warnings found/);
    output = runCLI(`lint ${myapp} --maxWarning=1`, { silenceError: true });
    expect(output).toMatch(/warnings found/);
    output = runCLI(`lint ${myapp} --maxWarning=3`, { silenceError: true });
    expect(output).not.toMatch(/warnings found/);
    output = runCLI(`lint ${myapp} --quiet`, { silenceError: true });
    expect(output).not.toMatch(/warnings found/);
  }, 1000000);
});

forEachCli('angular', () => {
  describe('Linter', () => {
    it('empty test', () => {
      expect(1).toEqual(1);
    });
  });
});

import {
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

forEachCli((currentCLIName) => {
  describe('Bazel', () => {
    const ngapp = uniq('ngapp');
    const reactapp = uniq('reactapp');
    const nglib = uniq('nglib');
    const reactlib = uniq('reactlib');

    it('noop', () => {});

    xit('should generate build files for apps', () => {
      ensureProject();
      runCLI(`generate @nrwl/angular:app ${ngapp}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`apps/${ngapp}/BUILD.bazel`);

      runCLI(`generate @nrwl/react:app ${reactapp}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`apps/${reactapp}/BUILD.bazel`);
    });

    xit('should generate build files for libs', () => {
      runCLI(`generate @nrwl/angular:lib ${nglib}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`libs/${nglib}/BUILD.bazel`);

      runCLI(`generate @nrwl/angular:lib ${reactlib}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`libs/${reactlib}/BUILD.bazel`);
    });

    xit('should add dependencies to build files', () => {
      updateFile(`apps/${ngapp}/src/main.ts`, `import '@proj/${nglib}';`);
      runCLI('generate @nrwl/bazel:sync');
      expect(readFile(`apps/${ngapp}/BUILD.bazel`)).toContain(
        `//libs/${nglib}:${nglib}`
      );

      updateFile(`apps/${reactapp}/src/main.ts`, `import '@proj/${reactlib}';`);
      runCLI('generate @nrwl/bazel:sync');
      expect(readFile(`apps/${reactapp}/BUILD.bazel`)).toContain(
        `//libs/${reactlib}:${reactlib}`
      );
    });

    xit('should be able to lint projects with bazel', () => {
      const lintResult = runCommand(
        `./node_modules/.bin/bazel test //apps/${ngapp}:lint`
      );
      expect(lintResult).toContain('PASSED');
    });

    xit('should be able to build projects with bazel', () => {
      const buildResult = runCommand(
        `./node_modules/.bin/bazel build //apps/${ngapp}:build`
      );
    });

    xit('should be able to test projects with bazel', () => {
      const testResult = runCommand(
        `./node_modules/.bin/bazel test //apps/${ngapp}:test`
      );
      expect(testResult).toContain('PASSED');
    });

    xit('should be able to e2e test projects with bazel', () => {
      const e2eResult = runCommand(
        `./node_modules/.bin/bazel test //apps/${ngapp}-e2e:e2e`
      );
      expect(e2eResult).toContain('PASSED');
    });
  });
});

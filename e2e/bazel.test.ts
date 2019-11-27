import {
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  uniq,
  updateFile
} from './utils';

forEachCli(currentCLIName => {
  describe('Bazel', () => {
    const ngapp = uniq('ngapp');
    const reactapp = uniq('reactapp');
    const nglib = uniq('nglib');
    const reactlib = uniq('reactlib');

    it('should generate build files for apps', () => {
      ensureProject();
      runCLI(`generate @nrwl/angular:app ${ngapp}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`apps/${ngapp}/BUILD.bazel`);

      runCLI(`generate @nrwl/react:app ${reactapp}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`apps/${reactapp}/BUILD.bazel`);
    });

    it('should generate build files for libs', () => {
      runCLI(`generate @nrwl/angular:lib ${nglib}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`libs/${nglib}/BUILD.bazel`);

      runCLI(`generate @nrwl/angular:lib ${reactlib}`);
      runCLI('generate @nrwl/bazel:sync');
      checkFilesExist(`libs/${reactlib}/BUILD.bazel`);
    });

    it('should add dependencies to build files', () => {
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
  });
});

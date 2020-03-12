import { forEachCli, newProject, runCLI, uniq, updateFile } from './utils';

forEachCli(() => {
  describe('Buildable Libraries', () => {
    it('should be able to run the task for the specified project and its dependencies', () => {
      newProject();

      const myapp = uniq('myapp');
      const mylib1 = uniq('mylib1');
      const mylib2 = uniq('mylib1');
      runCLI(`generate @nrwl/react:app ${myapp}`);
      runCLI(`generate @nrwl/react:lib ${mylib1} --publishable`);
      runCLI(`generate @nrwl/react:lib ${mylib2} --publishable`);

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
          import "@proj/${mylib1}";
          import "@proj/${mylib2}";
        `
      );

      const buildWithDeps = runCLI(`build ${myapp} --with-deps --prod`);
      expect(buildWithDeps).toContain(`Running target "build" succeeded`);
      expect(buildWithDeps).toContain(`nx run ${myapp}:build:production`);
      expect(buildWithDeps).toContain(`nx run ${mylib1}:build`);
      expect(buildWithDeps).toContain(`nx run ${mylib2}:build`);

      const testsWithDeps = runCLI(`test ${myapp} --with-deps`);
      expect(testsWithDeps).toContain(`NX  Running target test for projects:`);
      expect(testsWithDeps).toContain(myapp);
      expect(testsWithDeps).toContain(mylib1);
      expect(testsWithDeps).toContain(mylib2);

      const testsWithoutDeps = runCLI(`test ${myapp}`);
      expect(testsWithoutDeps).not.toContain(mylib1);
    });
  });
});

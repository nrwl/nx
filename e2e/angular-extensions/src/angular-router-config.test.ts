import {
  expectTestsPass,
  getSelectedPackageManager,
  newProject,
  cleanupProject,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nrwl/e2e/utils';

describe('Angular Package', () => {
  describe('router config', () => {
    beforeEach(() => newProject());
    afterEach(() => cleanupProject());

    it('should support router config generation (lazy)', async () => {
      if (getSelectedPackageManager() !== 'npm') {
        const myapp = uniq('myapp');
        const mylib = uniq('mylib');
        runCLI(
          `generate @nrwl/angular:app ${myapp} --directory=myDir --routing`
        );
        runCLI(
          `generate @nrwl/angular:lib ${mylib} --directory=myDir --routing --lazy --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
        );

        runCLI(`build my-dir-${myapp} --aot`);
        expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
      }
    }, 1000000);

    it('should support router config generation (eager)', async () => {
      // TODO: npm build is failing for Angular because of webpack 4
      // remove this condition once `node` is migrated to webpack 5
      if (getSelectedPackageManager() !== 'npm') {
        const myapp = uniq('myapp');
        runCLI(
          `generate @nrwl/angular:app ${myapp} --directory=myDir --routing`
        );
        const mylib = uniq('mylib');
        runCLI(
          `generate @nrwl/angular:lib ${mylib} --directory=myDir --routing --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
        );

        runCLI(`build my-dir-${myapp} --aot`);
        expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
      }
    }, 1000000);
  });
});

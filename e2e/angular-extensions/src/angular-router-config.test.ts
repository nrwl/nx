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
    beforeAll(() => newProject());
    afterAll(() => cleanupProject());

    it('should support router config generation (lazy)', async () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');
      runCLI(`generate @nrwl/angular:app ${myapp} --directory=myDir --routing`);
      runCLI(
        `generate @nrwl/angular:lib ${mylib} --directory=myDir --routing --lazy --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
      );

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
    }, 1000000);

    it('should support router config generation (eager)', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --directory=myDir --routing`);
      const mylib = uniq('mylib');
      runCLI(
        `generate @nrwl/angular:lib ${mylib} --directory=myDir --routing --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
      );

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
    }, 1000000);
  });
});

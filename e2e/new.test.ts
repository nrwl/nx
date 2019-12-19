import {
  ensureProject,
  exists,
  expectTestsPass,
  getSize,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  forEachCli,
  checkFilesExist,
  tmpProjPath,
  supportUi
} from './utils';
import { toClassName } from '@nrwl/workspace';

forEachCli(() => {
  describe('Create New Workspace', () => {
    beforeEach(() => {
      ensureProject();
    });

    it('should work', async () => {
      const myapp = uniq('myapp');
      const mylib = uniq('mylib');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --directory=myDir --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:lib ${mylib} --directory=myDir --no-interactive`
      );

      updateFile(
        `apps/my-dir/${myapp}/src/app/app.module.ts`,
        `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { MyDir${toClassName(
          mylib
        )}Module } from '@proj/my-dir/${mylib}';
        import { AppComponent } from './app.component';

        @NgModule({
          imports: [BrowserModule, MyDir${toClassName(mylib)}Module],
          declarations: [AppComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
      );
      runCLI(`build my-dir-${myapp} --prod --output-hashing none`);

      checkFilesExist(
        `dist/apps/my-dir/${myapp}/main-es2015.js`,
        `dist/apps/my-dir/${myapp}/main-es5.js`
      );

      // This is a loose requirement because there are a lot of
      // influences external from this project that affect this.
      const es2015BundleSize = getSize(
        tmpProjPath(`dist/apps/my-dir/${myapp}/main-es2015.js`)
      );
      console.log(
        `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
      );
      expect(es2015BundleSize).toBeLessThanOrEqual(160000);

      const es5BundleSize = getSize(
        tmpProjPath(`dist/apps/my-dir/${myapp}/main-es5.js`)
      );
      console.log(`The current es5 bundle size is ${es5BundleSize / 1000} KB`);
      expect(es5BundleSize).toBeLessThanOrEqual(175000);

      // running tests for the app
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));

      // running tests for the lib
      expectTestsPass(await runCLIAsync(`test my-dir-${mylib} --no-watch`));

      if (supportUi()) {
        expect(
          runCLI(`e2e my-dir-${myapp}-e2e --headless --no-watch`)
        ).toContain('All specs passed!');
      }
    }, 1000000);

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

    it('should support Ivy', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --directory=myDir --routing --enable-ivy`
      );

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
    }, 1000000);
  });
});

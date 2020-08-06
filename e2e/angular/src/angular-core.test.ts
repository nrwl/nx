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
  supportUi,
} from '@nrwl/e2e/utils';
import { toClassName } from '@nrwl/workspace';

forEachCli(() => {
  describe('Angular Package', () => {
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
        `generate @nrwl/angular:lib ${mylib} --directory=myDir --add-module-spec --no-interactive`
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

      checkFilesExist(`dist/apps/my-dir/${myapp}/main.js`);

      // This is a loose requirement because there are a lot of
      // influences external from this project that affect this.
      const es2015BundleSize = getSize(
        tmpProjPath(`dist/apps/my-dir/${myapp}/main.js`)
      );
      console.log(
        `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
      );
      expect(es2015BundleSize).toBeLessThanOrEqual(125000);

      // running tests for the app
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));

      // running tests for the lib
      expectTestsPass(await runCLIAsync(`test my-dir-${mylib} --no-watch`));

      // if (supportUi()) {
      //   try {
      //     const r = runCLI(`e2e my-dir-${myapp}-e2e --headless --no-watch`);
      //     console.log(r);
      //     expect(r).toContain('All specs passed!');
      //   } catch (e) {
      //     console.log(e);
      //     if (e.stdout) {
      //       console.log(e.stdout.toString());
      //     }
      //     if (e.stderr) {
      //       console.log(e.stdout.toString());
      //     }
      //     throw e;
      //   }
      // }
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

    it('should support eslint', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --linter=eslint`);
      expect(runCLI(`lint ${myapp}`)).toContain('All files pass linting.');

      const mylib = uniq('mylib');
      runCLI(`generate @nrwl/angular:lib ${mylib} --linter=eslint`);
      expect(runCLI(`lint ${mylib}`)).toContain('All files pass linting.');
    });
  });
});

import {
  checkFilesExist,
  expectTestsPass,
  getSelectedPackageManager,
  getSize,
  killPorts,
  newProject,
  cleanupProject,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  runCypressTests,
  removeFile,
  checkFilesDoNotExist,
} from '@nrwl/e2e/utils';

import { names } from '@nrwl/devkit';

describe('Angular Package', () => {
  describe('core', () => {
    let proj: string;

    beforeEach(() => (proj = newProject()));
    afterEach(() => cleanupProject());

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
        import { MyDir${
          names(mylib).className
        }Module } from '@${proj}/my-dir/${mylib}';
        import { AppComponent } from './app.component';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          imports: [BrowserModule, MyDir${names(mylib).className}Module],
          declarations: [AppComponent, NxWelcomeComponent],
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
      expect(es2015BundleSize).toBeLessThanOrEqual(160000);

      // running tests for the app
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));

      // running tests for the lib
      expectTestsPass(await runCLIAsync(`test my-dir-${mylib} --no-watch`));

      if (runCypressTests()) {
        const e2eResults = runCLI(`e2e my-dir-${myapp}-e2e --no-watch`);
        expect(e2eResults).toContain('All specs passed!');
        expect(await killPorts()).toBeTruthy();
      }
    }, 1000000);

    it('should support building in parallel', () => {
      if (getSelectedPackageManager() === 'pnpm') {
        // TODO: This tests fails with pnpm but we should still enable this for other package managers
        return;
      }
      const myapp = uniq('myapp');
      const myapp2 = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp}`);
      runCLI(`generate @nrwl/angular:app ${myapp2}`);

      runCLI('run-many --target build --all --parallel');
    });

    it('should support Ivy', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --directory=myDir --routing --enable-ivy`
      );

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
    }, 1000000);

    it('should support workspaces w/o workspace config file', async () => {
      removeFile('workspace.json');
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --directory=myDir --routing --enable-ivy`
      );

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
      expect(() =>
        checkFilesDoNotExist('workspace.json', 'angular.json')
      ).not.toThrow();
    }, 1000000);
  });
});

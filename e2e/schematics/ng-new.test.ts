import {
  newApp,
  newLib,
  newProject,
  readJson,
  runCLI,
  updateFile,
  exists,
  runNgNew,
  cleanup,
  copyMissingPackages,
  getSize,
  expectTestsPass,
  runCLIAsync,
  ensureProject,
  uniq,
  runsInWSL
} from '../utils';
import { toClassName } from '@nrwl/schematics/src/utils/name-utils';

describe('Nrwl Workspace', () => {
  it('should work', async () => {
    ensureProject();
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');
    newApp(`${myapp} --directory=myDir`);
    newLib(`${mylib} --directory=myDir --framework=angular`);

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
    runCLI(`build --prod --project=my-dir-${myapp} --output-hashing none`);
    expect(exists(`./tmp/proj/dist/apps/my-dir/${myapp}/main.js`)).toEqual(
      true
    );

    // This is a loose requirement because there are a lot of
    // influences external from this project that affect this.
    const bundleSize = getSize(`./tmp/proj/dist/apps/my-dir/${myapp}/main.js`);
    console.log(`The current bundle size is ${bundleSize} KB`);
    expect(bundleSize).toBeLessThanOrEqual(200000);

    // running tests for the app
    expectTestsPass(
      await runCLIAsync(`test --project=my-dir-${myapp} --no-watch`)
    );

    // running tests for the lib
    expectTestsPass(
      await runCLIAsync(`test --project=my-dir-${mylib} --no-watch`)
    );

    if (!runsInWSL()) {
      expect(
        runCLI(`e2e --project=my-dir-${myapp}-e2e --headless --watch=false`)
      ).toContain('All specs passed!');
    }
  }, 1000000);

  it('should support router config generation (lazy)', async () => {
    ensureProject();
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');
    newApp(`${myapp} --directory=myDir --routing`);
    newLib(
      `${mylib} --directory=myDir --framework=angular --routing --lazy --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
    );

    runCLI(`build --aot --project=my-dir-${myapp}`);
    expectTestsPass(
      await runCLIAsync(`test --project=my-dir-${myapp} --no-watch`)
    );
  }, 1000000);

  it('should support router config generation (eager)', async () => {
    ensureProject();
    const myapp = uniq('myapp');
    newApp(`${myapp} --directory=myDir --routing`);
    const mylib = uniq('mylib');
    newLib(
      `${mylib} --directory=myDir --framework=angular --routing --parentModule=apps/my-dir/${myapp}/src/app/app.module.ts`
    );

    runCLI(`build --aot --project=my-dir-${myapp}`);
    expectTestsPass(
      await runCLIAsync(`test  --project=my-dir-${myapp} --no-watch`)
    );
  }, 1000000);
});

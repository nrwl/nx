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
  isNotWindows,
  updateProjectConfig,
  readFile,
  runCommandUntil,
  promisifiedTreeKill,
} from '@nrwl/e2e/utils';
import { ChildProcess } from 'child_process';

import { names } from '@nrwl/devkit';

describe('Angular Projects ', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  it('should generate an app, a lib, link them, build, sevre and test both correctly', async () => {
    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    const mylib = uniq('mylib');
    runCLI(
      `generate @nrwl/angular:app ${myapp} --directory=myDir --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:app ${myapp2} --directory=myDir --no-interactive`
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
    runCLI(
      `run-many --target build --projects=my-dir-${myapp},my-dir-${myapp2} --parallel --prod --output-hashing none`
    );

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

    runCLI(
      `run-many --target test --projects=my-dir-${myapp},my-dir-${mylib} --parallel`
    );

    if (runCypressTests()) {
      const e2eResults = runCLI(`e2e my-dir-${myapp}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }

    const process = await runCommandUntil(
      `serve my-dir-${myapp} -- --port=${4207}`,
      (output) => output.includes(`listening on localhost:${4207}`)
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(process.pid, 'SIGKILL');
      await killPorts(4207);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 1000000);

  it('should build the dependent buildable lib as well as the app', () => {
    // ARRANGE
    const app = uniq('app');
    const buildableLib = uniq('buildlib1');

    runCLI(`generate @nrwl/angular:app ${app} --style=css --no-interactive`);
    runCLI(
      `generate @nrwl/angular:library ${buildableLib} --buildable=true --no-interactive`
    );

    // update the app module to include a ref to the buildable lib
    updateFile(
      `apps/${app}/src/app/app.module.ts`,
      `
        import { BrowserModule } from '@angular/platform-browser';
        import { NgModule } from '@angular/core';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        import { AppComponent } from './app.component';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [BrowserModule, ${names(buildableLib).className}Module],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
    `
    );

    // update the angular.json
    updateProjectConfig(app, (config) => {
      config.targets.build.executor = '@nrwl/angular:webpack-browser';
      return config;
    });

    // ACT
    const libOutput = runCLI(
      `build ${app} --with-deps --configuration=development`
    );

    // ASSERT
    expect(libOutput).toContain(
      `Building entry point '@${proj}/${buildableLib}'`
    );
    expect(libOutput).toContain(`nx run ${app}:build:development`);

    // to proof it has been built from source the "main.js" should actually contain
    // the path to dist
    const mainBundle = readFile(`dist/apps/${app}/main.js`);
    expect(mainBundle).toContain(`dist/libs/${buildableLib}`);
  });

  it('MFE - should serve the host and remote apps successfully', async () => {
    // ACT + ASSERT
    const port1 = 4205;
    const port2 = 4206;
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');

    // generate host app
    runCLI(
      `generate @nrwl/angular:app ${hostApp} -- --mfe --mfeType=host --port=${port1} --routing --style=css --no-interactive`
    );

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:app ${remoteApp1} -- --mfe --mfeType=remote --host=${hostApp} --port=${port2} --routing --style=css --no-interactive`
    );
    let process: ChildProcess;

    try {
      process = await runCommandUntil(`serve-mfe ${hostApp}`, (output) => {
        return (
          output.includes(`listening on localhost:${port2}`) &&
          output.includes(`listening on localhost:${port1}`)
        );
      });
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
      }
      await killPorts(port1);
      await killPorts(port2);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);
});

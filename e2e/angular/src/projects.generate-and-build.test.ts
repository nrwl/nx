import { names } from '@nx/devkit';
import {
  checkFilesExist,
  getSize,
  killPort,
  killProcessAndPorts,
  readFile,
  runCLI,
  runCommandUntil,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { registerAngularProjectsSetup, app1, esbuildApp, lib1, proj } from './projects.setup';

describe('Angular Projects - generate and build', () => {
  registerAngularProjectsSetup();

  it('should successfully generate apps and libs and work correctly', async () => {
    const standaloneApp = uniq('standalone-app');
    runCLI(
      `generate @nx/angular:app my-dir/${standaloneApp} --bundler=webpack --no-interactive`
    );

    const esbuildStandaloneApp = uniq('esbuild-app');
    runCLI(
      `generate @nx/angular:app my-dir/${esbuildStandaloneApp} --bundler=esbuild --no-interactive`
    );

    updateFile(
      `${app1}/src/app/app-module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { App } from './app';
        import { appRoutes } from './app.routes';
        import { NxWelcome } from './nx-welcome';
        import { ${names(lib1).className} } from '@${proj}/${lib1}';

        @NgModule({
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(lib1).className}
          ],
          declarations: [App, NxWelcome],
          bootstrap: [App]
        })
        export class AppModule {}
      `
    );

    // check build
    runCLI(
      `run-many --target build --projects=${app1},${esbuildApp},${standaloneApp},${esbuildStandaloneApp} --parallel --prod --output-hashing none`
    );
    checkFilesExist(`dist/${app1}/main.js`);
    checkFilesExist(`dist/${esbuildApp}/browser/main.js`);
    checkFilesExist(`dist/my-dir/${standaloneApp}/main.js`);
    checkFilesExist(`dist/my-dir/${esbuildStandaloneApp}/browser/main.js`);
    // This is a loose requirement because there are a lot of
    // influences external from this project that affect this.
    const es2015BundleSize = getSize(tmpProjPath(`dist/${app1}/main.js`));
    console.log(
      `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
    );
    expect(es2015BundleSize).toBeLessThanOrEqual(221000);

    // check unit tests
    runCLI(
      `run-many --target test --projects=${app1},${standaloneApp},${esbuildStandaloneApp},${lib1} --parallel`
    );

    // check e2e tests
    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app1}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }

    const appPort = 4207;
    const process = await runCommandUntil(
      `serve ${app1} -- --port=${appPort}`,
      (output) => output.includes(`listening on localhost:${appPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, appPort);

    const esbProcess = await runCommandUntil(
      `serve ${esbuildStandaloneApp} -- --port=${appPort}`,
      (output) =>
        output.includes(`Application bundle generation complete`) &&
        output.includes(`localhost:${appPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(esbProcess.pid, appPort);
  }, 1000000);
});

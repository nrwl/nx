import {
  checkFilesExist,
  getSize,
  killPort,
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { names } from '@nx/devkit';

import {
  app1,
  esbuildApp,
  lib1,
  getProjName,
  setupAngularProjectsSuite,
} from './projects.setup';

describe('Angular Projects - generate apps and libs', () => {
  setupAngularProjectsSuite();

  it('should successfully generate apps and libs and work correctly', async () => {
    const proj = getProjName();
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

    runCLI(
      `run-many --target build --projects=${app1},${esbuildApp},${standaloneApp},${esbuildStandaloneApp} --parallel --prod --output-hashing none`
    );
    checkFilesExist(`dist/${app1}/main.js`);
    checkFilesExist(`dist/${esbuildApp}/browser/main.js`);
    checkFilesExist(`dist/my-dir/${standaloneApp}/main.js`);
    checkFilesExist(`dist/my-dir/${esbuildStandaloneApp}/browser/main.js`);

    const es2015BundleSize = getSize(tmpProjPath(`dist/${app1}/main.js`));
    console.log(
      `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
    );
    expect(es2015BundleSize).toBeLessThanOrEqual(221000);

    runCLI(
      `run-many --target test --projects=${app1},${standaloneApp},${esbuildStandaloneApp},${lib1} --parallel`
    );

    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app1}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }

    const appPort = 4207;
    const process = await runCommandUntil(
      `serve ${app1} -- --port=${appPort}`,
      (output) => output.includes(`listening on localhost:${appPort}`)
    );

    await killProcessAndPorts(process.pid, appPort);

    const esbProcess = await runCommandUntil(
      `serve ${esbuildStandaloneApp} -- --port=${appPort}`,
      (output) =>
        output.includes(`Application bundle generation complete`) &&
        output.includes(`localhost:${appPort}`)
    );

    await killProcessAndPorts(esbProcess.pid, appPort);
  }, 1000000);
});


import { names } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  getSize,
  killPort,
  killProcessAndPorts,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Angular Projects - generate and build', () => {
  let proj: string;
  const app1 = uniq('app1');
  const esbuildApp = uniq('esbuild-app');
  const lib1 = uniq('lib1');
  let app1DefaultModule: string;
  let app1DefaultComponentTemplate: string;
  let esbuildAppDefaultModule: string;
  let esbuildAppDefaultComponentTemplate: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/angular'] });
    runCLI(
      `generate @nx/angular:app ${app1} --no-standalone --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --no-standalone --no-interactive`
    );
    runCLI(`generate @nx/angular:lib ${lib1} --no-interactive`);
    app1DefaultModule = readFile(`${app1}/src/app/app-module.ts`);
    app1DefaultComponentTemplate = readFile(`${app1}/src/app/app.html`);
    esbuildAppDefaultModule = readFile(`${esbuildApp}/src/app/app-module.ts`);
    esbuildAppDefaultComponentTemplate = readFile(
      `${esbuildApp}/src/app/app.html`
    );
  });

  afterEach(() => {
    updateFile(`${app1}/src/app/app-module.ts`, app1DefaultModule);
    updateFile(`${app1}/src/app/app.html`, app1DefaultComponentTemplate);
    updateFile(`${esbuildApp}/src/app/app-module.ts`, esbuildAppDefaultModule);
    updateFile(
      `${esbuildApp}/src/app/app.html`,
      esbuildAppDefaultComponentTemplate
    );
  });

  afterAll(() => cleanupProject());

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

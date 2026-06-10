import { names } from '@nx/devkit';
import {
  checkFilesExist,
  getSize,
  killPort,
  killProcessAndPorts,
  readFile,
  reservePort,
  runCLI,
  runCommandUntil,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import {
  setupProjectsTest,
  resetProjectsTest,
  cleanupProjectsTest,
  ProjectsTestSetup,
} from './projects-setup';

describe('Angular Projects - Build and Test', () => {
  let setup: ProjectsTestSetup;

  beforeAll(async () => {
    setup = await setupProjectsTest();
  });

  afterEach(() => {
    resetProjectsTest(setup);
  });

  afterAll(() => cleanupProjectsTest());

  it('should successfully generate apps and libs and work correctly', async () => {
    const { proj, app1, esbuildApp, lib1, app1Port } = setup;
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
    expect(es2015BundleSize).toBeLessThanOrEqual(223000);

    // check unit tests
    runCLI(
      `run-many --target test --projects=${app1},${standaloneApp},${esbuildStandaloneApp},${lib1} --parallel`
    );

    // check e2e tests
    if (runE2ETests('playwright')) {
      // app1 was generated with --port=app1Port, so its e2e serves there
      expect(() => runCLI(`e2e ${app1}-e2e`)).not.toThrow();
      expect(await killPort(app1Port)).toBeTruthy();
    }

    const appPort = await reservePort();
    const process = await runCommandUntil(
      `serve ${app1} -- --port=${appPort}`,
      (output) => output.includes(`listening on localhost:${appPort}`),
      { timeout: 120000 }
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, appPort);

    const esbProcess = await runCommandUntil(
      `serve ${esbuildStandaloneApp} -- --port=${appPort}`,
      (output) =>
        output.includes(`Application bundle generation complete`) &&
        output.includes(`localhost:${appPort}`),
      { timeout: 120000 }
    );

    // port and process cleanup
    await killProcessAndPorts(esbProcess.pid, appPort);
  }, 1000000);

  it('should successfully work with rspack for build', async () => {
    const app = uniq('app');
    const port = await reservePort();
    runCLI(
      `generate @nx/angular:app my-dir/${app} --port=${port} --bundler=rspack --no-interactive`
    );
    runCLI(`build ${app}`, {
      env: { NODE_ENV: 'production' },
    });

    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(port)).toBeTruthy();
    }
  }, 1000000);

  it('should successfully generate and run tests for vitest-angular', async () => {
    // Workspace default unitTestRunner is vitest-analog (set when app1
    // was generated with --bundler=webpack via setGeneratorDefaults
    // during projects-setup), so opt into vitest-angular explicitly.
    // - App: --bundler=esbuild required (uses @angular/build:unit-test).
    // - Lib: --buildable required (uses @nx/angular:unit-test against
    //   the built output).
    const app = uniq('vitest-angular-app');
    runCLI(
      `generate @nx/angular:app ${app} --bundler=esbuild --unitTestRunner=vitest-angular --no-interactive`
    );

    const lib = uniq('vitest-angular-lib');
    runCLI(
      `generate @nx/angular:lib ${lib} --buildable --unitTestRunner=vitest-angular --no-interactive`
    );

    runCLI(`run-many --target test --projects=${app},${lib}`);
  }, 1000000);

  it('should successfully work with playwright for e2e tests', async () => {
    const app = uniq('app');
    const port = await reservePort();

    runCLI(
      `generate @nx/angular:app ${app} --port=${port} --e2eTestRunner=playwright --no-interactive`
    );

    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(port)).toBeTruthy();
    }
  }, 1000000);
});

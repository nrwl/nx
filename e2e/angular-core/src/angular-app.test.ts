process.env.SELECTED_CLI = 'angular';

import {
  getSelectedPackageManager,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readFile,
  readJson,
  cleanupProject,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  readProjectConfig,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';
import { ChildProcess } from 'child_process';

// TODO: Check why this fails on yarn and npm
describe('Angular Package', () => {
  let proj: string;

  beforeAll(() => {
    // This fails with pnpm due to incompatibilities with ngcc.
    // Since this suite has a single test, we wrap everything to avoid the hooks to run and
    // waste time.
    // therefore switch to yarn

    proj =
      getSelectedPackageManager() === 'pnpm'
        ? newProject({ packageManager: 'npm' })
        : newProject();
  });

  afterAll(() => cleanupProject());

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

  it('should build the app successfully', () => {
    // ARRANGE
    const app = uniq('app');
    // generate app
    runCLI(
      `generate @nrwl/angular:app ${app} --routing --style=css --no-interactive`
    );

    // ACT
    const serveOutput = runCLI(`build ${app}`);

    // ASSERT
    expect(serveOutput).toContain('Running target "build" succeeded');
  }, 1000000);

  it('should serve the app successfully', async () => {
    // ARRANGE
    const app = uniq('app');
    // generate app
    runCLI(
      `generate @nrwl/angular:app ${app} --routing --style=css --no-interactive`
    );
    // ACT
    const port = 4201;

    // ASSERT
    const process = await runCommandUntil(
      `serve ${app} -- --port=${port}`,
      (output) => output.includes(`listening on localhost:${port}`)
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(process.pid, 'SIGKILL');
      await killPorts(port);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 3000000);
});

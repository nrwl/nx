process.env.SELECTED_CLI = 'angular';

import {
  getSelectedPackageManager,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readFile,
  readJson,
  removeProject,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';
import * as http from 'http';

// TODO: Check why this fails on yarn and npm
describe('Angular Package', () => {
  describe('app builder', () => {
    let app;
    let buildableLib;
    let proj: string;

    // This fails with pnpm due to incompatibilities with ngcc.
    // Since this suite has a single test, we wrap everything to avoid the hooks to run and
    // waste time.
    if (getSelectedPackageManager() !== 'pnpm') {
      beforeEach(() => {
        app = uniq('app');
        buildableLib = uniq('buildlib1');

        proj = newProject();

        runCLI(
          `generate @nrwl/angular:app ${app} --style=css --no-interactive`
        );
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

        @NgModule({
          declarations: [AppComponent],
          imports: [BrowserModule, ${names(buildableLib).className}Module],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
    `
        );

        // update the angular.json
        const workspaceJson = readJson(`angular.json`);
        workspaceJson.projects[app].architect.build.builder =
          '@nrwl/angular:webpack-browser';
        updateFile('angular.json', JSON.stringify(workspaceJson, null, 2));
      });

      afterEach(() => removeProject({ onlyOnCI: true }));

      it('should build the dependent buildable lib as well as the app', () => {
        const libOutput = runCLI(
          `build ${app} --with-deps --configuration=development`
        );
        expect(libOutput).toContain(
          `Building entry point '@${proj}/${buildableLib}'`
        );
        expect(libOutput).toContain(`nx run ${app}:build:development`);

        // to proof it has been built from source the "main.js" should actually contain
        // the path to dist
        const mainBundle = readFile(`dist/apps/${app}/main.js`);
        expect(mainBundle).toContain(`dist/libs/${buildableLib}`);
      });
    } else {
      it('Skip tests with pnpm', () => {});
    }
  });
});

describe('Angular MFE App Serve', () => {
  let hostApp;
  let remoteApp1;
  let remoteApp2;
  let proj: string;

  beforeAll(() => {
    // Increase the timeout as there are 3 apps to build and serve
    jest.setTimeout(300000);
  });

  beforeEach(() => {
    hostApp = uniq('app');
    remoteApp1 = uniq('remote');

    proj = newProject();

    // generate host app
    runCLI(
      `generate @nrwl/angular:app ${hostApp} --mfe --mfeType=host --routing --style=css --no-interactive`
    );

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:app ${remoteApp1} --mfe --mfeType=remote --host=${hostApp} --port=4201 --routing --style=css --no-interactive`
    );
  });

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should serve the host and remote apps successfully', async () => {
    // ACT + ASSERT
    const process = await runCommandUntil(
      `serve-mfe ${hostApp}`,
      (output) =>
        output.includes('listening on localhost:4200') &&
        output.includes('listening on localhost:4201')
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(process.pid, 'SIGKILL');
      await killPorts(4200);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });
});

describe('Angular App Build and Serve Ops', () => {
  let app;
  let proj: string;

  beforeEach(() => {
    app = uniq('app');

    proj = newProject();

    // generate app
    runCLI(
      `generate @nrwl/angular:app ${app} --routing --style=css --no-interactive`
    );
  });

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should build the app successfully', () => {
    // ACT
    const serveOutput = runCLI(`build ${app}`);

    // ASSERT
    expect(serveOutput).toContain('Running target "build" succeeded');
  });

  it('should serve the app successfully', async () => {
    // ACT
    const port = 4201;

    // ASSERT
    const process = await runCommandUntil(
      `serve ${app} --port=${port}`,
      (output) =>
        output.includes(`listening on localhost:${port}`) &&
        output.includes('Compiled successfully')
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(process.pid, 'SIGKILL');
      await killPorts(port);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });
});

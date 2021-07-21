process.env.SELECTED_CLI = 'angular';

import {
  getSelectedPackageManager,
  newProject,
  readFile,
  readJson,
  removeProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';

// TODO: Check why this fails on yarn and npm
xdescribe('Angular Nrwl app builder', () => {
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
      const libOutput = runCLI(`build ${app} --with-deps`);
      expect(libOutput).toContain(
        `Building entry point '@${proj}/${buildableLib}'`
      );
      expect(libOutput).toContain(`nx run ${app}:build`);

      // to proof it has been built from source the "main.js" should actually contain
      // the path to dist
      const mainBundle = readFile(`dist/apps/${app}/main.js`);
      expect(mainBundle).toContain(`dist/libs/${buildableLib}`);
    });
  } else {
    it('Skip tests with pnpm', () => {});
  }
});

describe('Angular MFE App Serve', () => {
  let hostApp;
  let remoteApp1;
  let remoteApp2;
  let proj: string;

  beforeEach(() => {
    hostApp = uniq('app');
    remoteApp1 = uniq('remoteApp1');
    remoteApp2 = uniq('remoteApp2');

    proj = newProject();

    // generate host app
    runCLI(
      `generate @nrwl/angular:app ${hostApp} --mfe --mfeType=host --routing --style=css --no-interactive`
    );

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:app ${remoteApp1} --mfe --mfeType=remote --host=${hostApp} --port=4201 --routing --style=css --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:app ${remoteApp2} --mfe --mfeType=remote --host=${hostApp} --port=4202 --routing --style=css --no-interactive`
    );
  });

  afterEach(() => removeProject({ onlyOnCI: true }));

  it('should serve the host and remote apps successfully', () => {
    // ACT
    const serveOutput = runCLI(`serve-mfe ${hostApp}`);

    // ASSERT
    expect(serveOutput).toContain('Compiled successfully');
    expect(serveOutput).toContain(
      'Angular Live Development Server is listening on localhost:4200'
    );
    expect(serveOutput).toContain(
      'Angular Live Development Server is listening on localhost:4201'
    );
    expect(serveOutput).toContain(
      'Angular Live Development Server is listening on localhost:4202'
    );
  });
});

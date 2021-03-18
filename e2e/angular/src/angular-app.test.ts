import {
  newProject,
  readFile,
  readJson,
  removeProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';

describe('Angular Nrwl app builder', () => {
  let app;
  let buildableLib;
  let proj: string;

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
});

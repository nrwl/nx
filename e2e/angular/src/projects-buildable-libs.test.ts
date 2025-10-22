import { names } from '@nx/devkit';
import { readFile, runCLI, uniq, updateFile, updateJson } from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupProjectsTest,
  resetProjectsTest,
  cleanupProjectsTest,
  ProjectsTestSetup,
} from './projects-setup';

describe('Angular Projects - Buildable Libraries', () => {
  let setup: ProjectsTestSetup;

  beforeAll(() => {
    setup = setupProjectsTest();
  });

  afterEach(() => {
    resetProjectsTest(setup);
  });

  afterAll(() => cleanupProjectsTest());

  it('should build the dependent buildable lib and its child lib, as well as the app', async () => {
    const { proj, app1, esbuildApp } = setup;

    // ARRANGE
    const buildableLib = uniq('buildlib1');
    const buildableChildLib = uniq('buildlib2');

    runCLI(
      `generate @nx/angular:library ${buildableLib} --buildable=true --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library ${buildableChildLib} --buildable=true --no-standalone --no-interactive`
    );

    // update the app module to include a ref to the buildable lib
    updateFile(
      `${app1}/src/app/app-module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { App } from './app';
        import { appRoutes } from './app.routes';
        import { NxWelcome } from './nx-welcome';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        @NgModule({
          declarations: [App, NxWelcome],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(buildableLib).className}Module
          ],
          providers: [],
          bootstrap: [App],
        })
        export class AppModule {}
    `
    );
    updateFile(
      `${esbuildApp}/src/app/app-module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { App } from './app';
        import { appRoutes } from './app.routes';
        import { NxWelcome } from './nx-welcome';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        @NgModule({
          declarations: [App, NxWelcome],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(buildableLib).className}Module
          ],
          providers: [],
          bootstrap: [App],
        })
        export class AppModule {}
    `
    );

    // update the buildable lib module to include a ref to the buildable child lib
    updateFile(
      `${buildableLib}/src/lib/${names(buildableLib).fileName}-module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { ${
          names(buildableChildLib).className
        }Module } from '@${proj}/${buildableChildLib}';
        
        @NgModule({
          imports: [CommonModule, ${names(buildableChildLib).className}Module],
        })
        export class ${names(buildableLib).className}Module {}
        
      `
    );

    // update the project.json
    updateJson(join(app1, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:webpack-browser';
      config.targets.build.options = {
        ...config.targets.build.options,
        buildLibsFromSource: false,
      };
      return config;
    });
    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:browser-esbuild';
      config.targets.build.options = {
        ...config.targets.build.options,
        outputPath: `dist/${esbuildApp}`,
        index: `${esbuildApp}/src/index.html`,
        main: config.targets.build.options.browser,
        browser: undefined,
        buildLibsFromSource: false,
      };
      return config;
    });

    // update the nx.json
    updateJson('nx.json', (config) => {
      config.targetDefaults ??= {};
      config.targetDefaults['@nx/angular:webpack-browser'] ??= {
        cache: true,
        dependsOn: [`^build`],
        inputs:
          config.namedInputs && 'production' in config.namedInputs
            ? ['production', '^production']
            : ['default', '^default'],
      };
      config.targetDefaults['@nx/angular:browser-esbuild'] ??= {
        cache: true,
        dependsOn: [`^build`],
        inputs:
          config.namedInputs && 'production' in config.namedInputs
            ? ['production', '^production']
            : ['default', '^default'],
      };
      return config;
    });

    // ACT
    const libOutput = runCLI(`build ${app1} --configuration=development`);
    const esbuildLibOutput = runCLI(
      `build ${esbuildApp} --configuration=development`
    );

    // ASSERT
    expect(libOutput).toContain(
      `Building entry point '@${proj}/${buildableLib}'`
    );
    expect(libOutput).toContain(`nx run ${app1}:build:development`);

    // to proof it has been built from source the "main.js" should actually contain
    // the path to dist
    const mainBundle = readFile(`dist/${app1}/main.js`);
    expect(mainBundle).toContain(`dist/${buildableLib}`);

    const mainEsBuildBundle = readFile(`dist/${esbuildApp}/main.js`);
    expect(mainEsBuildBundle).toContain(`dist/${buildableLib}`);
  });
});

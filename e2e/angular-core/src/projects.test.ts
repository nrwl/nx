import { names } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  getSize,
  killPorts,
  killProcessAndPorts,
  newProject,
  readFile,
  removeFile,
  runCLI,
  runCommandUntil,
  runCypressTests,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nx/e2e/utils';
import { normalize } from 'path';

describe('Angular Projects', () => {
  let proj: string;
  const app1 = uniq('app1');
  const lib1 = uniq('lib1');
  let app1DefaultModule: string;
  let app1DefaultComponentTemplate: string;

  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nx/angular:app ${app1} --no-interactive`);
    runCLI(
      `generate @nx/angular:lib ${lib1} --add-module-spec --no-interactive`
    );
    app1DefaultModule = readFile(`apps/${app1}/src/app/app.module.ts`);
    app1DefaultComponentTemplate = readFile(
      `apps/${app1}/src/app/app.component.html`
    );
  });

  afterEach(() => {
    updateFile(`apps/${app1}/src/app/app.module.ts`, app1DefaultModule);
    updateFile(
      `apps/${app1}/src/app/app.component.html`,
      app1DefaultComponentTemplate
    );
  });

  afterAll(() => cleanupProject());

  it('should successfully generate apps and libs and work correctly', async () => {
    const standaloneApp = uniq('standalone-app');
    runCLI(
      `generate @nx/angular:app ${standaloneApp} --directory=myDir --standalone=true --no-interactive`
    );

    const esbuildApp = uniq('esbuild-app');
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --directory=myDir --no-interactive`
    );

    updateFile(
      `apps/${app1}/src/app/app.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { ${names(lib1).className}Module } from '@${proj}/${lib1}';
        import { AppComponent } from './app.component';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          imports: [BrowserModule, ${names(lib1).className}Module],
          declarations: [AppComponent, NxWelcomeComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
    );

    // check build
    runCLI(
      `run-many --target build --projects=${app1},my-dir-${standaloneApp},my-dir-${esbuildApp} --parallel --prod --output-hashing none`
    );
    checkFilesExist(`dist/apps/${app1}/main.js`);
    checkFilesExist(`dist/apps/my-dir/${standaloneApp}/main.js`);
    checkFilesExist(`dist/apps/my-dir/${esbuildApp}/main.js`);
    // This is a loose requirement because there are a lot of
    // influences external from this project that affect this.
    const es2015BundleSize = getSize(tmpProjPath(`dist/apps/${app1}/main.js`));
    console.log(
      `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
    );
    expect(es2015BundleSize).toBeLessThanOrEqual(160000);

    // check unit tests
    runCLI(
      `run-many --target test --projects=${app1},my-dir-${standaloneApp},my-dir-${esbuildApp},${lib1} --parallel`
    );

    // check e2e tests
    if (runCypressTests()) {
      const e2eResults = runCLI(`e2e ${app1}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }

    const appPort = 4207;
    const process = await runCommandUntil(
      `serve ${app1} -- --port=${appPort}`,
      (output) => output.includes(`listening on localhost:4207`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, appPort);
  }, 1000000);

  it('should lint correctly with eslint and handle external HTML files and inline templates', async () => {
    // check apps and lib pass linting for initial generated code
    runCLI(`run-many --target lint --projects=${app1},${lib1} --parallel`);

    // External HTML template file
    const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
    updateFile(
      `apps/${app1}/src/app/app.component.html`,
      templateWhichFailsBananaInBoxLintCheck
    );
    // Inline template within component.ts file
    const wrappedAsInlineTemplate = `
      import { Component } from '@angular/core';

      @Component({
        selector: 'inline-template-component',
        template: \`
          ${templateWhichFailsBananaInBoxLintCheck}
        \`,
      })
      export class InlineTemplateComponent {}
    `;
    updateFile(
      `apps/${app1}/src/app/inline-template.component.ts`,
      wrappedAsInlineTemplate
    );

    const appLintStdOut = runCLI(`lint ${app1}`, {
      silenceError: true,
    });
    expect(appLintStdOut).toContain(
      normalize(`apps/${app1}/src/app/app.component.html`)
    );
    expect(appLintStdOut).toContain(`1:6`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);
    expect(appLintStdOut).toContain(
      normalize(`apps/${app1}/src/app/inline-template.component.ts`)
    );
    expect(appLintStdOut).toContain(`5:19`);
    expect(appLintStdOut).toContain(
      `The selector should start with one of these prefixes`
    );
    expect(appLintStdOut).toContain(`7:16`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);

    // cleanup added component
    removeFile(`apps/${app1}/src/app/inline-template.component.ts`);
  }, 1000000);

  it('should build the dependent buildable lib and its child lib, as well as the app', async () => {
    // ARRANGE
    const buildableLib = uniq('buildlib1');
    const buildableChildLib = uniq('buildlib2');

    runCLI(
      `generate @nx/angular:library ${buildableLib} --buildable=true --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library ${buildableChildLib} --buildable=true --no-interactive`
    );

    // update the app module to include a ref to the buildable lib
    updateFile(
      `apps/${app1}/src/app/app.module.ts`,
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

    // update the buildable lib module to include a ref to the buildable child lib
    updateFile(
      `libs/${buildableLib}/src/lib/${names(buildableLib).fileName}.module.ts`,
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

    // update the angular.json
    updateProjectConfig(app1, (config) => {
      config.targets.build.executor = '@nx/angular:webpack-browser';
      config.targets.build.options = {
        ...config.targets.build.options,
        buildLibsFromSource: false,
      };
      return config;
    });

    // ACT
    const libOutput = runCLI(`build ${app1} --configuration=development`);

    // ASSERT
    expect(libOutput).toContain(
      `Building entry point '@${proj}/${buildableLib}'`
    );
    expect(libOutput).toContain(`nx run ${app1}:build:development`);

    // to proof it has been built from source the "main.js" should actually contain
    // the path to dist
    const mainBundle = readFile(`dist/apps/${app1}/main.js`);
    expect(mainBundle).toContain(`dist/libs/${buildableLib}`);
  });

  it('should build publishable libs successfully', () => {
    // ARRANGE
    const lib = uniq('lib');
    const childLib = uniq('child');
    const entryPoint = uniq('entrypoint');

    runCLI(
      `generate @nx/angular:lib ${lib} --publishable --importPath=@${proj}/${lib} --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
    );

    runCLI(
      `generate @nx/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=sub --library=${childLib} --no-interactive`
    );

    const moduleContent = `
    import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
          import { ${
            names(childLib).className
          }Module } from '@${proj}/${childLib}';
    import { SubModule } from '@${proj}/${childLib}/sub';
    @NgModule({
      imports: [CommonModule, ${names(childLib).className}Module, SubModule]
    })
    export class ${names(lib).className}Module {}`;

    updateFile(`libs/${lib}/src/lib/${lib}.module.ts`, moduleContent);

    // ACT
    const buildOutput = runCLI(`build ${lib}`);

    // ASSERT
    expect(buildOutput).toContain(`Building entry point '@${proj}/${lib}'`);
    expect(buildOutput).toContain(
      `Building entry point '@${proj}/${lib}/${entryPoint}'`
    );
    expect(buildOutput).toContain('Successfully ran target build');
  });
});

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
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join, normalize } from 'path';

describe('Angular Projects', () => {
  let proj: string;
  const app1 = uniq('app1');
  const lib1 = uniq('lib1');
  let app1DefaultModule: string;
  let app1DefaultComponentTemplate: string;

  beforeAll(() => {
    proj = newProject();
    runCLI(
      `generate @nx/angular:app ${app1} --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:lib ${lib1} --add-module-spec --project-name-and-root-format=as-provided --no-interactive`
    );
    app1DefaultModule = readFile(`${app1}/src/app/app.module.ts`);
    app1DefaultComponentTemplate = readFile(
      `${app1}/src/app/app.component.html`
    );
  });

  afterEach(() => {
    updateFile(`${app1}/src/app/app.module.ts`, app1DefaultModule);
    updateFile(
      `${app1}/src/app/app.component.html`,
      app1DefaultComponentTemplate
    );
  });

  afterAll(() => cleanupProject());

  it('should successfully generate apps and libs and work correctly', async () => {
    const standaloneApp = uniq('standalone-app');
    runCLI(
      `generate @nx/angular:app ${standaloneApp} --directory=my-dir/${standaloneApp} --standalone=true --project-name-and-root-format=as-provided --no-interactive`
    );

    const esbuildApp = uniq('esbuild-app');
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --directory=my-dir/${esbuildApp} --project-name-and-root-format=as-provided --no-interactive`
    );

    updateFile(
      `${app1}/src/app/app.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';
        import { ${names(lib1).className}Module } from '@${proj}/${lib1}';

        @NgModule({
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(lib1).className}Module
          ],
          declarations: [AppComponent, NxWelcomeComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
    );

    // check build
    runCLI(
      `run-many --target build --projects=${app1},${standaloneApp},${esbuildApp} --parallel --prod --output-hashing none`
    );
    checkFilesExist(`dist/${app1}/main.js`);
    checkFilesExist(`dist/my-dir/${standaloneApp}/main.js`);
    checkFilesExist(`dist/my-dir/${esbuildApp}/main.js`);
    // This is a loose requirement because there are a lot of
    // influences external from this project that affect this.
    const es2015BundleSize = getSize(tmpProjPath(`dist/${app1}/main.js`));
    console.log(
      `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
    );
    expect(es2015BundleSize).toBeLessThanOrEqual(210000);

    // check unit tests
    runCLI(
      `run-many --target test --projects=${app1},${standaloneApp},${esbuildApp},${lib1} --parallel`
    );

    // check e2e tests
    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${app1}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }

    const appPort = 4207;
    const process = await runCommandUntil(
      `serve ${app1} -- --port=${appPort}`,
      (output) => output.includes(`listening on localhost:${appPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, appPort);

    const esbProcess = await runCommandUntil(
      `serve ${esbuildApp} -- --port=${appPort}`,
      (output) =>
        output.includes(`Application bundle generation complete`) &&
        output.includes(`localhost:${appPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(esbProcess.pid, appPort);
  }, 1000000);

  // TODO: enable this when tests are passing again.
  xit('should successfully work with playwright for e2e tests', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/angular:app ${app} --e2eTestRunner=playwright --project-name-and-root-format=as-provided --no-interactive`
    );

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${app}-e2e`);
      expect(e2eResults).toContain(
        `Successfully ran target e2e for project ${app}-e2e`
      );
      expect(await killPorts()).toBeTruthy();
    }
  }, 1000000);

  it('should lint correctly with eslint and handle external HTML files and inline templates', async () => {
    // check apps and lib pass linting for initial generated code
    runCLI(`run-many --target lint --projects=${app1},${lib1} --parallel`);

    // External HTML template file
    const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
    updateFile(
      `${app1}/src/app/app.component.html`,
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
      `${app1}/src/app/inline-template.component.ts`,
      wrappedAsInlineTemplate
    );

    const appLintStdOut = runCLI(`lint ${app1}`, {
      silenceError: true,
    });
    expect(appLintStdOut).toContain(
      normalize(`${app1}/src/app/app.component.html`)
    );
    expect(appLintStdOut).toContain(`1:6`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);
    expect(appLintStdOut).toContain(
      normalize(`${app1}/src/app/inline-template.component.ts`)
    );
    expect(appLintStdOut).toContain(`5:19`);
    expect(appLintStdOut).toContain(
      `The selector should start with one of these prefixes`
    );
    expect(appLintStdOut).toContain(`7:16`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);

    // cleanup added component
    removeFile(`${app1}/src/app/inline-template.component.ts`);
  }, 1000000);

  it('should build the dependent buildable lib and its child lib, as well as the app', async () => {
    // ARRANGE
    const esbuildApp = uniq('esbuild-app');
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --project-name-and-root-format=as-provided --no-interactive`
    );

    const buildableLib = uniq('buildlib1');
    const buildableChildLib = uniq('buildlib2');

    runCLI(
      `generate @nx/angular:library ${buildableLib} --buildable=true --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library ${buildableChildLib} --buildable=true --project-name-and-root-format=as-provided --no-interactive`
    );

    // update the app module to include a ref to the buildable lib
    updateFile(
      `${app1}/src/app/app.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(buildableLib).className}Module
          ],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
    `
    );
    updateFile(
      `${esbuildApp}/src/app/app.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(buildableLib).className}Module
          ],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
    `
    );

    // update the buildable lib module to include a ref to the buildable child lib
    updateFile(
      `${buildableLib}/src/lib/${names(buildableLib).fileName}.module.ts`,
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
        buildLibsFromSource: false,
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

  it('should build publishable libs successfully', () => {
    // ARRANGE
    const lib = uniq('lib');
    const childLib = uniq('child');
    const entryPoint = uniq('entrypoint');

    runCLI(
      `generate @nx/angular:lib ${lib} --publishable --importPath=@${proj}/${lib} --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
    );

    runCLI(
      `generate @nx/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --project-name-and-root-format=as-provided --no-interactive`
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

    updateFile(`${lib}/src/lib/${lib}.module.ts`, moduleContent);

    // ACT
    const buildOutput = runCLI(`build ${lib}`);

    // ASSERT
    expect(buildOutput).toContain(`Building entry point '@${proj}/${lib}'`);
    expect(buildOutput).toContain(
      `Building entry point '@${proj}/${lib}/${entryPoint}'`
    );
    expect(buildOutput).toContain('Successfully ran target build');
  });

  it('should support generating projects with --project-name-and-root-format=derived', () => {
    const appName = uniq('app1');
    const libName = uniq('lib1');

    runCLI(
      `generate @nx/angular:app ${appName} --project-name-and-root-format=derived --no-interactive`
    );

    // check files are generated with the layout directory ("apps/")
    checkFilesExist(`apps/${appName}/src/app/app.module.ts`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    runCLI(
      `generate @nx/angular:lib ${libName} --buildable --project-name-and-root-format=derived`
    );

    // check files are generated with the layout directory ("libs/")
    checkFilesExist(
      `libs/${libName}/src/index.ts`,
      `libs/${libName}/src/lib/${libName}.module.ts`
    );
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
    // check tests pass
    const libTestResult = runCLI(`test ${libName}`);
    expect(libTestResult).toContain(
      `Successfully ran target test for project ${libName}`
    );
  }, 500_000);

  it('should support generating libraries with a scoped name when --project-name-and-root-format=as-provided', () => {
    const libName = uniq('@my-org/lib1');

    // assert scoped project names are not supported when --project-name-and-root-format=derived
    expect(() =>
      runCLI(
        `generate @nx/angular:lib ${libName} --buildable --project-name-and-root-format=derived`
      )
    ).toThrow();

    runCLI(
      `generate @nx/angular:lib ${libName} --buildable --project-name-and-root-format=as-provided`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(
      `${libName}/src/index.ts`,
      `${libName}/src/lib/${libName.split('/')[1]}.module.ts`
    );
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
    // check tests pass
    const libTestResult = runCLI(`test ${libName}`);
    expect(libTestResult).toContain(
      `Successfully ran target test for project ${libName}`
    );
  }, 500_000);
});

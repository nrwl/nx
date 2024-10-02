import { names } from '@nx/devkit';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSize,
  killPort,
  killProcessAndPorts,
  newProject,
  readFile,
  removeFile,
  rmDist,
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
  const esbuildApp = uniq('esbuild-app');
  const lib1 = uniq('lib1');
  let app1DefaultModule: string;
  let app1DefaultComponentTemplate: string;
  let esbuildAppDefaultModule: string;
  let esbuildAppDefaultComponentTemplate: string;
  let esbuildAppDefaultProjectConfig: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/angular'] });
    runCLI(
      `generate @nx/angular:app ${app1} --no-standalone --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --no-standalone --no-interactive`
    );
    runCLI(`generate @nx/angular:lib ${lib1} --no-interactive`);
    app1DefaultModule = readFile(`${app1}/src/app/app.module.ts`);
    app1DefaultComponentTemplate = readFile(
      `${app1}/src/app/app.component.html`
    );
    esbuildAppDefaultModule = readFile(`${esbuildApp}/src/app/app.module.ts`);
    esbuildAppDefaultComponentTemplate = readFile(
      `${esbuildApp}/src/app/app.component.html`
    );
    esbuildAppDefaultProjectConfig = readFile(`${esbuildApp}/project.json`);
  });

  afterEach(() => {
    updateFile(`${app1}/src/app/app.module.ts`, app1DefaultModule);
    updateFile(
      `${app1}/src/app/app.component.html`,
      app1DefaultComponentTemplate
    );
    updateFile(`${esbuildApp}/src/app/app.module.ts`, esbuildAppDefaultModule);
    updateFile(
      `${esbuildApp}/src/app/app.component.html`,
      esbuildAppDefaultComponentTemplate
    );
    updateFile(`${esbuildApp}/project.json`, esbuildAppDefaultProjectConfig);
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
      `${app1}/src/app/app.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';
        import { ${names(lib1).className}Component } from '@${proj}/${lib1}';

        @NgModule({
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
            ${names(lib1).className}Component
          ],
          declarations: [AppComponent, NxWelcomeComponent],
          bootstrap: [AppComponent]
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

  it('should successfully work with playwright for e2e tests', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/angular:app ${app} --e2eTestRunner=playwright --no-interactive`
    );

    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
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
        outputPath: `dist/${esbuildApp}`,
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

  it('should support esbuild plugins', async () => {
    updateFile(
      `${esbuildApp}/replace-text.plugin.mjs`,
      `const replaceTextPlugin = {
        name: 'replace-text',
        setup(build) {
          const options = build.initialOptions;
          options.define.BUILD_DEFINED = '"Value was provided at build time"';
        },
      };
      
      export default replaceTextPlugin;`
    );
    updateFile(
      `${esbuildApp}/src/app/app.component.ts`,
      `import { Component } from '@angular/core';

      declare const BUILD_DEFINED: string;

      @Component({
        selector: 'app-root',
        templateUrl: './app.component.html',
      })
      export class AppComponent {
        title = 'esbuild-app';
        buildDefined = BUILD_DEFINED;
      }`
    );

    // check @nx/angular:application
    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        plugins: [`${esbuildApp}/replace-text.plugin.mjs`],
      };
      return config;
    });

    runCLI(`build ${esbuildApp} --configuration=development`);

    let mainBundle = readFile(`dist/${esbuildApp}/browser/main.js`);
    expect(mainBundle).toContain(
      'buildDefined = "Value was provided at build time";'
    );

    // check @nx/angular:browser-esbuild
    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:browser-esbuild';
      config.targets.build.options = {
        ...config.targets.build.options,
        main: config.targets.build.options.browser,
        browser: undefined,
      };
      return config;
    });

    runCLI(`build ${esbuildApp} --configuration=development`);

    mainBundle = readFile(`dist/${esbuildApp}/main.js`);
    expect(mainBundle).toContain(
      'buildDefined = "Value was provided at build time";'
    );
  });

  it('should support providing a transformer function for the "index.html" file with the application executor', async () => {
    updateFile(
      `${esbuildApp}/index.transformer.mjs`,
      `const indexHtmlTransformer = (indexContent) => {
        return indexContent.replace(
          '<title>${esbuildApp}</title>',
          '<title>${esbuildApp} (transformed)</title>'
        );
      };
      
      export default indexHtmlTransformer;`
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        indexHtmlTransformer: `${esbuildApp}/index.transformer.mjs`,
      };
      return config;
    });

    runCLI(`build ${esbuildApp}`);

    let indexHtmlContent = readFile(`dist/${esbuildApp}/browser/index.html`);
    expect(indexHtmlContent).toContain(
      `<title>${esbuildApp} (transformed)</title>`
    );
  });

  it('should build publishable libs successfully', () => {
    // ARRANGE
    const lib = uniq('lib');
    const childLib = uniq('child');
    const entryPoint = uniq('entrypoint');

    runCLI(
      `generate @nx/angular:lib ${lib} --publishable --importPath=@${proj}/${lib} --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
    );

    runCLI(
      `generate @nx/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-standalone --no-interactive`
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
    const buildOutput = runCLI(`build ${lib}`, { env: { CI: 'false' } });

    // ASSERT
    expect(buildOutput).toContain(`Building entry point '@${proj}/${lib}'`);
    expect(buildOutput).toContain(
      `Building entry point '@${proj}/${lib}/${entryPoint}'`
    );
    expect(buildOutput).toContain('Successfully ran target build');

    expect(() => runCLI(`lint ${lib} --fix`)).not.toThrow();
    expect(() => runCLI(`lint ${childLib} --fix`)).not.toThrow();
  });

  it('should support generating libraries with a scoped name when', () => {
    const libName = uniq('@my-org/lib1');

    runCLI(`generate @nx/angular:lib ${libName} --buildable --standalone`);

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(
      `${libName}/src/index.ts`,
      `${libName}/src/lib/${libName.split('/')[1]}/${
        libName.split('/')[1]
      }.component.ts`
    );
    // check build works
    expect(() => runCLI(`build ${libName}`)).not.toThrow();
    // check tests pass
    expect(() => runCLI(`test ${libName}`)).not.toThrow();
  }, 500_000);

  it('should support generating applications with SSR and converting targets with webpack-based executors to use the application executor', async () => {
    const esbuildApp = uniq('esbuild-app');
    const webpackApp = uniq('webpack-app');

    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --ssr --no-interactive`
    );

    // check build produces both the browser and server bundles
    runCLI(`build ${esbuildApp} --output-hashing none`);
    checkFilesExist(
      `dist/${esbuildApp}/browser/main.js`,
      `dist/${esbuildApp}/server/server.mjs`
    );

    runCLI(
      `generate @nx/angular:app ${webpackApp} --bundler=webpack --ssr --no-interactive`
    );

    // check build only produces the browser bundle
    runCLI(`build ${webpackApp} --output-hashing none`);
    checkFilesExist(`dist/${webpackApp}/browser/main.js`);
    checkFilesDoNotExist(`dist/${webpackApp}/server/main.js`);

    // check server produces the server bundle
    runCLI(`server ${webpackApp} --output-hashing none`);
    checkFilesExist(`dist/${webpackApp}/server/main.js`);

    rmDist();

    // convert target with webpack-based executors to use the application executor
    runCLI(
      `generate @nx/angular:convert-to-application-executor ${webpackApp}`
    );

    // check build now produces both the browser and server bundles
    runCLI(`build ${webpackApp} --output-hashing none`);
    checkFilesExist(
      `dist/${webpackApp}/browser/main.js`,
      `dist/${webpackApp}/server/server.mjs`
    );

    // check server target is no longer available
    expect(() =>
      runCLI(`server ${webpackApp} --output-hashing none`)
    ).toThrow();
  }, 500_000);
});

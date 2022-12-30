import type { Tree } from '@nrwl/devkit';
import { names, updateJson } from '@nrwl/devkit';

export interface AppConfig {
  appName: string; // name of app
  appModule: string; // app/app.module.ts in the above sourceDir
}
export interface LibConfig {
  name: string;
  module: string;
  barrel: string;
}

var appConfig: AppConfig; // configure built in createApp()
var libConfig: LibConfig;

export function getAppConfig(): AppConfig {
  return appConfig;
}
export function getLibConfig(): LibConfig {
  return libConfig;
}

export function createApp(
  tree: Tree,
  appName: string,
  routing: boolean = true
) {
  appName = names(appName).fileName;
  // save for getAppDir() lookup by external *.spec.ts tests
  appConfig = {
    appName,
    appModule: `/apps/${appName}/src/app/app.module.ts`,
  };

  tree.write(
    appConfig.appModule,
    `
     import { NgModule } from '@angular/core';
     import { BrowserModule } from '@angular/platform-browser';
     ${routing ? "import { RouterModule } from '@angular/router'" : ''};
     import { AppComponent } from './app.component';
     @NgModule({
       imports: [BrowserModule, ${routing ? 'RouterModule.forRoot([])' : ''}],
       declarations: [AppComponent],
       bootstrap: [AppComponent]
     })
     export class AppModule {}
  `
  );
  tree.write(
    `/apps/${appName}/src/main.ts`,
    `
    import { enableProdMode } from '@angular/core';
    import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

    import { AppModule } from './app/app.module';
    import { environment } from './environments/environment';

    if (environment.production) {
      enableProdMode();
    }

    platformBrowserDynamic()
      .bootstrapModule(AppModule)
      .catch(err => console.log(err));
  `
  );
  tree.write(
    `/apps/${appName}/tsconfig.app.json`,
    JSON.stringify({
      include: ['**/*.ts'],
    })
  );
  tree.write(
    `/apps/${appName}-e2e/tsconfig.e2e.json`,
    JSON.stringify({
      include: ['../**/*.ts'],
    })
  );
  tree.write(
    '/workspace.json',
    JSON.stringify({
      newProjectRoot: '',
      version: 1,
      projects: {
        [appName]: {
          root: `apps/${appName}`,
          sourceRoot: `apps/${appName}/src`,
          architect: {
            build: {
              options: {
                main: `apps/${appName}/src/main.ts`,
              },
            },
            serve: {
              options: {},
            },
          },
          tags: [],
        },
      },
    })
  );
}

export function createLib(tree: Tree, libName: string) {
  const { name, className, fileName, propertyName } = names(libName);

  libConfig = {
    name,
    module: `/libs/${propertyName}/src/lib/${fileName}.module.ts`,
    barrel: `/libs/${propertyName}/src/index.ts`,
  };

  tree.write(
    libConfig.module,
    `
      import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      @NgModule({
        imports: [
          CommonModule
        ],
        providers: []
      })
      export class ${className}Module { }
  `
  );
  tree.write(
    libConfig.barrel,
    `
    export * from './lib/${fileName}.module';
  `
  );
}

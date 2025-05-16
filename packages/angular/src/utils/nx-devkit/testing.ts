import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, names, updateJson } from '@nx/devkit';

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
    appModule: `${appName}/src/app/app.module.ts`,
  };

  tree.write(
    appConfig.appModule,
    `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
${routing ? "import { RouterModule } from '@angular/router'" : ''};
import { App } from './app';
@NgModule({
  imports: [BrowserModule, ${routing ? 'RouterModule.forRoot([])' : ''}],
  declarations: [App],
  bootstrap: [App]
})
export class AppModule {}
`
  );
  tree.write(
    `${appName}/src/main.ts`,
    `import { platformBrowser } from '@angular/platform-browser';

import { AppModule } from './app/app.module';

platformBrowser()
  .bootstrapModule(AppModule)
  .catch(err => console.log(err));
  `
  );
  tree.write(
    `${appName}/tsconfig.app.json`,
    JSON.stringify({
      include: ['**/*.ts'],
    })
  );
  tree.write(
    `${appName}-e2e/tsconfig.e2e.json`,
    JSON.stringify({
      include: ['../**/*.ts'],
    })
  );
  addProjectConfiguration(tree, appName, {
    root: `${appName}`,
    sourceRoot: `${appName}/src`,
    targets: {
      build: {
        options: {
          main: `${appName}/src/main.ts`,
        },
      },
      serve: {
        options: {},
      },
    },
    tags: [],
  });
}

export function createLib(tree: Tree, libName: string) {
  const { name, className, fileName, propertyName } = names(libName);

  libConfig = {
    name,
    module: `${propertyName}/src/lib/${fileName}.module.ts`,
    barrel: `${propertyName}/src/index.ts`,
  };

  tree.write(
    libConfig.module,
    `import { NgModule } from '@angular/core';
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
    `export * from './lib/${fileName}.module';
`
  );
}

import { Tree } from '@angular-devkit/schematics';
import { names } from './name-utils';
import { NxJson } from '../command-line/shared';
import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

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

export const schematicRunner = new SchematicTestRunner(
  '@nrwl/schematics',
  path.join(__dirname, '../collection.json')
);

export function runSchematic(
  name: string,
  options: any,
  tree: Tree
): Promise<UnitTestTree> {
  return schematicRunner
    .runSchematicAsync(name, { ...options, skipFormat: true }, tree)
    .toPromise();
}

export function createEmptyWorkspace(tree: Tree): Tree {
  tree.create(
    '/angular.json',
    JSON.stringify({ projects: {}, newProjectRoot: '' })
  );
  tree.create(
    '/package.json',
    JSON.stringify({
      dependencies: {},
      devDependencies: {}
    })
  );
  tree.create(
    '/nx.json',
    JSON.stringify(<NxJson>{ npmScope: 'proj', projects: {} })
  );
  tree.create(
    '/tsconfig.json',
    JSON.stringify({ compilerOptions: { paths: {} } })
  );
  tree.create(
    '/tslint.json',
    JSON.stringify({
      rules: {
        'nx-enforce-module-boundaries': [
          true,
          {
            npmScope: '<%= npmScope %>',
            lazyLoad: [],
            allow: []
          }
        ]
      }
    })
  );
  return tree;
}

export function createApp(
  tree: Tree,
  appName: string,
  routing: boolean = true
): Tree {
  // save for getAppDir() lookup by external *.spec.ts tests
  appConfig = {
    appName,
    appModule: `/apps/${appName}/src/app/app.module.ts`
  };

  tree.create(
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
  tree.create(
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
  tree.create(
    `/apps/${appName}/tsconfig.app.json`,
    JSON.stringify({
      include: ['**/*.ts']
    })
  );
  tree.create(
    `/apps/${appName}-e2e/tsconfig.e2e.json`,
    JSON.stringify({
      include: ['../**/*.ts']
    })
  );
  tree.overwrite(
    '/angular.json',
    JSON.stringify({
      newProjectRoot: '',
      projects: {
        [appName]: {
          root: `apps/${appName}/src`,
          architect: {
            build: {
              options: {
                main: `apps/${appName}/src/main.ts`
              }
            }
          }
        }
      }
    })
  );
  return tree;
}

export function createLib(tree: Tree, libName: string): Tree {
  const { name, className, fileName, propertyName } = names(libName);

  libConfig = {
    name,
    module: `/libs/${propertyName}/src/lib/${fileName}.module.ts`,
    barrel: `/libs/${propertyName}/src/index.ts`
  };

  tree.create(
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
  tree.create(
    libConfig.barrel,
    `
    export * from './lib/${fileName}.module';
  `
  );
  return tree;
}

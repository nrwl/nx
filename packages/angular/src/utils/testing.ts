import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';
import { MockBuilderContext } from '@nrwl/workspace/testing';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { Architect } from '@angular-devkit/architect';
import { names } from '@nrwl/devkit';

const testRunner = new SchematicTestRunner(
  '@nrwl/angular',
  join(__dirname, '../../collection.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/collection.json')
);

testRunner.registerCollection(
  '@nrwl/workspace',
  join(__dirname, '../../../workspace/collection.json')
);

testRunner.registerCollection(
  '@nrwl/cypress',
  join(__dirname, '../../../cypress/collection.json')
);

testRunner.registerCollection(
  '@nrwl/storybook',
  join(__dirname, '../../../storybook/collection.json')
);

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/workspace',
  join(__dirname, '../../migrations.json')
);

export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function runMigration<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return migrationTestRunner
    .runSchematicAsync(schematicName, options, tree)
    .toPromise();
}

export function runExternalSchematic<SchemaOptions = any>(
  collectionName: string,
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner
    .runExternalSchematicAsync(collectionName, schematicName, options, tree)
    .toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

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
): Tree {
  appName = names(appName).fileName;
  // save for getAppDir() lookup by external *.spec.ts tests
  appConfig = {
    appName,
    appModule: `/apps/${appName}/src/app/app.module.ts`,
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
      include: ['**/*.ts'],
    })
  );
  tree.create(
    `/apps/${appName}-e2e/tsconfig.e2e.json`,
    JSON.stringify({
      include: ['../**/*.ts'],
    })
  );
  tree.overwrite(
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
        },
      },
    })
  );
  return tree;
}

export function createLib(tree: Tree, libName: string): Tree {
  const { name, className, fileName, propertyName } = names(libName);

  libConfig = {
    name,
    module: `/libs/${propertyName}/src/lib/${fileName}.module.ts`,
    barrel: `/libs/${propertyName}/src/index.ts`,
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

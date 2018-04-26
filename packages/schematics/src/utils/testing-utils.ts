import { Tree } from '@angular-devkit/schematics';

export interface AppConfig {
  appName: string; // name of app or lib
  appModule: string; // app/app.module.ts in the above sourceDir
}

var appConfig: AppConfig; // configure built in createApp()

export function getAppConfig(): AppConfig {
  return appConfig;
}

export function createEmptyWorkspace(tree: Tree): Tree {
  tree.create(
    '/angular.json',
    JSON.stringify({ projects: {}, newProjectRoot: '' })
  );
  tree.create('/package.json', JSON.stringify({}));
  tree.create('/nx.json', JSON.stringify({ npmScope: 'proj', projects: {} }));
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
  // tree.overwrite(
  //   '/angular.json',
  //   JSON.stringify({
  //     projects: {
  //
  //     },
  //     apps: [
  //       {
  //         name: appName,
  //         root: `apps/${appName}/src`,
  //         main: 'main.ts',
  //         index: 'index.html'
  //       }
  //     ]
  //   })
  // );
  return tree;
}

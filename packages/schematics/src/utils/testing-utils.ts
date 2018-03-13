import { Tree } from '@angular-devkit/schematics';

export function createEmptyWorkspace(tree: Tree): Tree {
  tree.create('/.angular-cli.json', JSON.stringify({}));
  tree.create('/package.json', JSON.stringify({}));
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

export function createApp(tree: Tree, appName: string): Tree {
  tree.create(
    `/apps/${appName}/src/app/app.module.ts`,
    `
     import { NgModule } from '@angular/core';
     import { BrowserModule } from '@angular/platform-browser';
     import { RouterModule } from '@angular/router';
     import { AppComponent } from './app.component';
     @NgModule({
       imports: [BrowserModule, RouterModule.forRoot([])],
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
    `/apps/${appName}/src/tsconfig.app.json`,
    JSON.stringify({
      include: ['**/*.ts']
    })
  );
  tree.create(
    `/apps/${appName}/e2e/tsconfig.e2e.json`,
    JSON.stringify({
      include: ['../**/*.ts']
    })
  );
  tree.overwrite(
    '/.angular-cli.json',
    JSON.stringify({
      project: {
        name: 'proj',
        npmScope: 'proj'
      },
      apps: [
        {
          name: appName,
          root: `apps/${appName}/src`,
          main: 'main.ts',
          index: 'index.html'
        }
      ]
    })
  );
  return tree;
}

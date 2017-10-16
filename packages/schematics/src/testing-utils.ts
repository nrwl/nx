import { Tree } from '@angular-devkit/schematics';

export function createEmptyWorkspace(tree: Tree): Tree {
  tree.create('/.angular-cli.json', JSON.stringify({}));
  tree.create('/package.json', JSON.stringify({}));
  return tree;
}

export function createApp(tree: Tree, appName: string): Tree {
  tree.create(
    `/apps/${appName}/src/app/app.module.ts`,
    `
     import { NgModule } from '@angular/core';
     import { BrowserModule } from '@angular/platform-browser';
     import { AppComponent } from './app.component';
     @NgModule({
       imports: [BrowserModule],
       declarations: [AppComponent],
       bootstrap: [AppComponent]
     })
     export class AppModule {}
  `
  );
  return tree;
}

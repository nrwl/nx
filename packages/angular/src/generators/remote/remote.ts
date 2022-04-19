import { joinPathFragments, Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { getProjects, readProjectConfiguration } from '@nrwl/devkit';
import applicationGenerator from '../application/application';
import { getMfeProjects } from '../../utils/get-mfe-projects';

function findNextAvailablePort(tree: Tree) {
  const mfeProjects = getMfeProjects(tree);

  const ports = new Set<number>([4200]);
  for (const mfeProject of mfeProjects) {
    const { targets } = readProjectConfiguration(tree, mfeProject);
    const port = targets?.serve?.options?.port ?? 4200;
    ports.add(port);
  }

  const nextAvailablePort = Math.max(...ports) + 1;

  return nextAvailablePort;
}

export default async function remote(tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  const installTask = await applicationGenerator(tree, {
    ...options,
    mfe: true,
    mfeType: 'remote',
    routing: true,
    host: options.host,
    port: options.port ?? findNextAvailablePort(tree),
  });

  removeDeadCode(tree, options);

  return installTask;
}

function removeDeadCode(tree: Tree, options: Schema) {
  const project = readProjectConfiguration(tree, options.name);

  ['css', 'less', 'scss', 'sass'].forEach((style) => {
    const pathToComponentStyle = joinPathFragments(
      project.sourceRoot,
      `app/app.component.${style}`
    );
    if (tree.exists(pathToComponentStyle)) {
      tree.delete(pathToComponentStyle);
    }
  });

  tree.delete(
    joinPathFragments(project.sourceRoot, 'app/nx-welcome.component.ts')
  );
  tree.delete(
    joinPathFragments(project.sourceRoot, 'app/app.component.spec.ts')
  );
  tree.delete(joinPathFragments(project.sourceRoot, 'app/app.component.html'));

  const pathToComponent = joinPathFragments(
    project.sourceRoot,
    'app/app.component.ts'
  );
  const component =
    tree.read(pathToComponent, 'utf-8').split('templateUrl')[0] +
    `template: '<router-outlet></router-outlet>'
})
export class AppComponent {}`;

  tree.write(pathToComponent, component);

  tree.write(
    joinPathFragments(project.sourceRoot, 'app/app.module.ts'),
    `/*
* This RemoteEntryModule is imported here to allow TS to find the Module during
* compilation, allowing it to be included in the built bundle. This is required
* for the Module Federation Plugin to expose the Module correctly.
* */
import { RemoteEntryModule } from './remote-entry/entry.module';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';

@NgModule({
 declarations: [AppComponent],
 imports: [
   BrowserModule,
   RouterModule.forRoot([{
     path: '',
     loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule)
   }], { initialNavigation: 'enabledBlocking' }),
 ],
 providers: [],
 bootstrap: [AppComponent],
})
export class AppModule {}`
  );
}

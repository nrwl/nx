import {
  getProjects,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import { getMFProjects } from '../../utils/get-mf-projects';
import { normalizeProjectName } from '../utils/project';

function findNextAvailablePort(tree: Tree) {
  const mfProjects = getMFProjects(tree);

  const ports = new Set<number>([4200]);
  for (const mfProject of mfProjects) {
    const { targets } = readProjectConfiguration(tree, mfProject);
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
    mf: true,
    mfType: 'remote',
    routing: true,
    host: options.host,
    port: options.port ?? findNextAvailablePort(tree),
  });

  removeDeadCode(tree, options);

  return installTask;
}

function removeDeadCode(tree: Tree, options: Schema) {
  const projectName = normalizeProjectName(options.name, options.directory);
  const project = readProjectConfiguration(tree, projectName);

  ['css', 'less', 'scss', 'sass'].forEach((style) => {
    const pathToComponentStyle = joinPathFragments(
      project.sourceRoot,
      `app/app.component.${style}`
    );
    if (tree.exists(pathToComponentStyle)) {
      tree.delete(pathToComponentStyle);
    }
  });

  tree.rename(
    joinPathFragments(project.sourceRoot, 'app/nx-welcome.component.ts'),
    joinPathFragments(
      project.sourceRoot,
      'app/remote-entry/nx-welcome.component.ts'
    )
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
    `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

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

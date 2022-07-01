import {
  formatFiles,
  getProjects,
  joinPathFragments,
  names,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import remoteGenerator from '../remote/remote';
import { normalizeProjectName } from '../utils/project';
import * as ts from 'typescript';
import { addRoute } from '../../utils/nx-devkit/ast-utils';

export default async function host(tree: Tree, options: Schema) {
  const projects = getProjects(tree);

  const remotesToGenerate: string[] = [];
  const remotesToIntegrate: string[] = [];

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        remotesToGenerate.push(remote);
      } else {
        remotesToIntegrate.push(remote);
      }
    });
  }

  const installTask = await applicationGenerator(tree, {
    ...options,
    mf: true,
    mfType: 'host',
    routing: true,
    remotes: remotesToIntegrate ?? [],
    port: 4200,
    federationType: options.dynamic ? 'dynamic' : 'static',
    skipFormat: true,
  });

  for (const remote of remotesToGenerate) {
    await remoteGenerator(tree, {
      ...options,
      name: remote,
      host: normalizeProjectName(options.name, options.directory),
      skipFormat: true,
    });
  }

  routeToNxWelcome(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function routeToNxWelcome(tree: Tree, options: Schema) {
  const { sourceRoot } = readProjectConfiguration(
    tree,
    normalizeProjectName(options.name, options.directory)
  );

  const remoteRoutes =
    options.remotes && Array.isArray(options.remotes)
      ? options.remotes.reduce(
          (routes, remote) =>
            `${routes}\n<li><a routerLink='${normalizeProjectName(
              remote,
              options.directory
            )}'>${names(remote).className}</a></li>`,
          ''
        )
      : '';

  tree.write(
    joinPathFragments(sourceRoot, 'app/app.component.html'),
    `<ul class="remote-menu">
<li><a routerLink='/'>Home</a></li>
${remoteRoutes}
</ul>
<router-outlet></router-outlet>
`
  );

  const pathToHostAppModule = joinPathFragments(
    sourceRoot,
    'app/app.module.ts'
  );
  const hostAppModule = tree.read(pathToHostAppModule, 'utf-8');

  if (!hostAppModule.includes('RouterModule.forRoot(')) {
    return;
  }

  let sourceFile = ts.createSourceFile(
    pathToHostAppModule,
    hostAppModule,
    ts.ScriptTarget.Latest,
    true
  );

  sourceFile = addRoute(
    tree,
    pathToHostAppModule,
    sourceFile,
    `{
         path: '', 
         component: NxWelcomeComponent
     }`
  );
}

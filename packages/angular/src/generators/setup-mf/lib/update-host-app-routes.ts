import { Tree } from 'nx/src/generators/tree';
import { readProjectConfiguration } from 'nx/src/generators/utils/project-configuration';
import { generateFiles, joinPathFragments, names } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { Schema } from '../schema';

let tsModule: typeof import('typescript');

export function updateHostAppRoutes(tree: Tree, options: Schema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const { sourceRoot } = readProjectConfiguration(tree, options.appName);

  const remoteRoutes =
    options.remotes && Array.isArray(options.remotes)
      ? options.remotes.reduce(
          (routes, remote) =>
            `${routes}\n<li><a routerLink='${remote}'>${
              names(remote).className
            }</a></li>`,
          ''
        )
      : '';

  tree.write(
    joinPathFragments(sourceRoot, 'app/app.component.html'),
    `<ul class="remote-menu">
<li><a routerLink='/'>Home</a></li>${remoteRoutes}
</ul>
<router-outlet></router-outlet>
`
  );

  let pathToHostRootRoutingFile = joinPathFragments(
    sourceRoot,
    'app/app.routes.ts'
  );

  let hostRootRoutingFile = tree.read(pathToHostRootRoutingFile, 'utf-8');

  if (!hostRootRoutingFile) {
    pathToHostRootRoutingFile = joinPathFragments(
      sourceRoot,
      'app/app-routing.module.ts'
    );
    hostRootRoutingFile = tree.read(pathToHostRootRoutingFile, 'utf-8');
  }

  let sourceFile = tsModule.createSourceFile(
    pathToHostRootRoutingFile,
    hostRootRoutingFile,
    tsModule.ScriptTarget.Latest,
    true
  );

  addRoute(
    tree,
    pathToHostRootRoutingFile,
    `{
      path: '',
      component: NxWelcomeComponent
    }`
  );

  tree.write(
    pathToHostRootRoutingFile,
    `import { NxWelcomeComponent } from './nx-welcome.component';
    ${tree.read(pathToHostRootRoutingFile, 'utf-8')}`
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/host-files'),
    joinPathFragments(sourceRoot, 'app'),
    {
      appName: options.appName,
      tmpl: '',
    }
  );
}

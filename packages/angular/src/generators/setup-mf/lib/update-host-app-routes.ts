import { Tree } from 'nx/src/generators/tree';
import { Schema } from '../schema';
import { readProjectConfiguration } from 'nx/src/generators/utils/project-configuration';
import { generateFiles, joinPathFragments, names } from '@nrwl/devkit';
import * as ts from 'typescript';
import { addRoute } from '../../../utils/nx-devkit/route-utils';

export function updateHostAppRoutes(tree: Tree, options: Schema) {
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
<li><a routerLink='/'>Home</a></li>
${remoteRoutes}
</ul>
<router-outlet></router-outlet>
`
  );

  const pathToHostRootRoutingFile = joinPathFragments(
    sourceRoot,
    'app/app.routes.ts'
  );

  const hostRootRoutingFile = tree.read(pathToHostRootRoutingFile, 'utf-8');

  let sourceFile = ts.createSourceFile(
    pathToHostRootRoutingFile,
    hostRootRoutingFile,
    ts.ScriptTarget.Latest,
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

import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function updateHostAppRoutes(tree: Tree, options: Schema) {
  const { sourceRoot } = readProjectConfiguration(tree, options.appName);

  tree.write(
    joinPathFragments(sourceRoot, 'app/app.component.html'),
    `<ul class="remote-menu">
<li><a routerLink="/">Home</a></li>
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

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/host-files'),
    joinPathFragments(sourceRoot, 'app'),
    {
      appName: options.appName,
      standalone: options.standalone,
      useRouterTestingModule: angularMajorVersion < 18,
      tmpl: '',
    }
  );
}

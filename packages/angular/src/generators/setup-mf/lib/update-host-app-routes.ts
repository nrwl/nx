import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import type { NormalizedOptions } from '../schema';

export function updateHostAppRoutes(tree: Tree, options: NormalizedOptions) {
  const { sourceRoot } = readProjectConfiguration(tree, options.appName);
  const { appComponentInfo, nxWelcomeComponentInfo } = options;

  tree.write(
    joinPathFragments(
      sourceRoot,
      'app',
      `${appComponentInfo.extensionlessFileName}.html`
    ),
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
      component: ${nxWelcomeComponentInfo.symbolName}
    }`
  );

  tree.write(
    pathToHostRootRoutingFile,
    `import { ${nxWelcomeComponentInfo.symbolName} } from './${
      nxWelcomeComponentInfo.extensionlessFileName
    }';
${tree.read(pathToHostRootRoutingFile, 'utf-8')}`
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/host-files'),
    joinPathFragments(sourceRoot, 'app'),
    {
      appName: options.appName,
      standalone: options.standalone,
      appFileName: appComponentInfo.extensionlessFileName,
      appSymbolName: appComponentInfo.symbolName,
      nxWelcomeFileName: nxWelcomeComponentInfo.extensionlessFileName,
      nxWelcomeSymbolName: nxWelcomeComponentInfo.symbolName,
      tmpl: '',
    }
  );
}

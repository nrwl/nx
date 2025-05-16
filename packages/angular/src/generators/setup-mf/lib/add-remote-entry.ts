import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedOptions } from '../schema';

export function addRemoteEntry(
  tree: Tree,
  options: NormalizedOptions,
  appRoot: string
) {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const {
    appName,
    routing,
    prefix,
    standalone,
    componentType,
    componentFileSuffix,
    nxWelcomeComponentInfo,
  } = options;

  generateFiles(
    tree,
    standalone
      ? joinPathFragments(
          __dirname,
          '../files/standalone-entry-component-files'
        )
      : joinPathFragments(__dirname, '../files/entry-module-files'),
    `${appRoot}/src/app/remote-entry`,
    {
      tmpl: '',
      appName,
      routing,
      prefix,
      // Angular v19 or higher defaults to true, while lower versions default to false
      setStandaloneFalse: angularMajorVersion >= 19,
      setStandaloneTrue: angularMajorVersion < 19,
      componentType,
      componentFileSuffix,
      nxWelcomeFileName: nxWelcomeComponentInfo.extensionlessFileName,
      nxWelcomeSymbolName: nxWelcomeComponentInfo.symbolName,
    }
  );

  if (standalone && routing) {
    addRoute(
      tree,
      joinPathFragments(appRoot, 'src/app/app.routes.ts'),
      `{path: '', loadChildren: () => import('./remote-entry/entry.routes').then(m => m.remoteRoutes)}`
    );
  } else if (routing) {
    addRoute(
      tree,
      joinPathFragments(appRoot, 'src/app/app.routes.ts'),
      `{ path: '', loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule) }`
    );
  }
}

import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import type { Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export function addRemoteEntry(
  tree: Tree,
  { appName, routing, prefix, standalone }: Schema,
  appRoot: string
) {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

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

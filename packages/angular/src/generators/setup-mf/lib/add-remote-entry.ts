import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, readNxJson } from '@nrwl/devkit';
import type { Schema } from '../schema';
import { addRoute } from '../../../utils/nx-devkit/route-utils';

export function addRemoteEntry(
  tree: Tree,
  { appName, routing, mfType, prefix, standalone }: Schema,
  appRoot: string
) {
  prefix = prefix ?? readNxJson(tree).npmScope;
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
    }
  );

  if (standalone && routing) {
    tree.write(
      `${appRoot}/src/app/app.routes.ts`,
      `/* 
      * This remoteRoutes array is imported here to allow TS to find it during 
      * compilation, allowing it to be included in the built bundle. This is required 
      * for the Module Federation Plugin to expose the Module correctly
      * in an Angular Standalone Components setup.
      * */
      import { remoteRoutes } from './remote-entry/entry.routes';
${tree.read(`${appRoot}/src/app/app.routes.ts`, 'utf-8')}`
    );
  } else {
    if (routing) {
      addRoute(
        tree,
        joinPathFragments(appRoot, 'src/app/app.routes.ts'),
        `{path: '', loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule)}`
      );
    }

    tree.write(
      `${appRoot}/src/app/app.module.ts`,
      `/* 
      * This RemoteEntryModule is imported here to allow TS to find the Module during 
      * compilation, allowing it to be included in the built bundle. This is required 
      * for the Module Federation Plugin to expose the Module correctly.
      * */
      import { RemoteEntryModule } from './remote-entry/entry.module';
${tree.read(`${appRoot}/src/app/app.module.ts`, 'utf-8')}`
    );
  }
}

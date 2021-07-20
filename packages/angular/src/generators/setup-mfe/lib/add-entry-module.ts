import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';
import {
  generateFiles,
  joinPathFragments,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';

export function addEntryModule(
  host: Tree,
  { appName, routing, mfeType }: Schema,
  appRoot: string
) {
  if (mfeType === 'remote') {
    const { npmScope } = readWorkspaceConfiguration(host);
    generateFiles(
      host,
      joinPathFragments(__dirname, '../files/entry-module-files'),
      `${appRoot}/src/app/remote-entry`,
      {
        tmpl: '',
        appName,
        npmScope,
        routing,
      }
    );

    host.write(
      `${appRoot}/src/app/app.module.ts`,
      `import { RemoteEntryModule } from './remote-entry/entry.module';
${host.read(`${appRoot}/src/app/app.module.ts`, 'utf-8')}`
    );
  }
}

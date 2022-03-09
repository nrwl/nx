import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments } from '@nrwl/devkit';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import type { NormalizedSchema } from './normalized-schema';

export function createFiles(
  host: Tree,
  options: NormalizedSchema,
  appProjectRoot: string
) {
  host.delete(`${appProjectRoot}/src/favicon.ico`);

  generateFiles(
    host,
    joinPathFragments(__dirname, '../files'),
    options.appProjectRoot,
    {
      ...options,
      rootTsConfigPath: getRelativePathToRootTsConfig(
        host,
        options.appProjectRoot
      ),
      tpl: '',
    }
  );
}

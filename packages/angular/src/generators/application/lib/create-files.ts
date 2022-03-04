import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, offsetFromRoot } from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
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
      rootTsConfigPath: `${offsetFromRoot(
        options.appProjectRoot
      )}${getRootTsConfigPathInTree(host)}`,
      tpl: '',
    }
  );
}

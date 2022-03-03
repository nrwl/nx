import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { generateFiles, joinPathFragments, offsetFromRoot } from '@nrwl/devkit';
import { getRootTsConfigPath } from '../../utils/typescript';

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
      )}${getRootTsConfigPath(host)}`,
      tpl: '',
    }
  );
}

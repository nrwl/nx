import type { Tree } from '@nx/devkit';
import {
  ensurePackage,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';
import { maybeJs } from '../../../utils/maybe-js';
import { NormalizedSchema } from '../../application/schema';
import { nxVersion } from '../../../utils/versions';

export function setupTspathForRemote(tree: Tree, options: NormalizedSchema) {
  const { normalizeProjectName } = ensurePackage<
    typeof import('@nx/module-federation')
  >('@nx/module-federation', nxVersion);
  const project = readProjectConfiguration(tree, options.projectName);

  const exportPath = maybeJs(options, './src/remote-entry.ts');

  const exportName = 'Module';

  addTsConfigPath(
    tree,
    `${normalizeProjectName(options.projectName)}/${exportName}`,
    [joinPathFragments(project.root, exportPath)]
  );
}

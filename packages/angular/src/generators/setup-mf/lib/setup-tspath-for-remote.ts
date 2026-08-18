import type { Tree } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';
import {
  ensurePackage,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';
import { nxVersion } from '../../../utils/versions';

export function setupTspathForRemote(tree: Tree, options: NormalizedOptions) {
  const { normalizeProjectName } = ensurePackage<
    typeof import('@nx/module-federation')
  >('@nx/module-federation', nxVersion);
  const project = readProjectConfiguration(tree, options.appName);

  const exportPath = options.standalone
    ? `./src/app/remote-entry/entry.routes.ts`
    : `./src/app/remote-entry/${options.entryModuleFileName}.ts`;

  const exportName = options.standalone ? 'Routes' : 'Module';

  addTsConfigPath(
    tree,
    `${normalizeProjectName(options.appName)}/${exportName}`,
    [joinPathFragments(project.root, exportPath)]
  );
}

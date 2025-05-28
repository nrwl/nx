import type { Tree } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';

export function setupTspathForRemote(tree: Tree, options: NormalizedOptions) {
  const project = readProjectConfiguration(tree, options.appName);

  const exportPath = options.standalone
    ? `./src/app/remote-entry/entry.routes.ts`
    : `./src/app/remote-entry/${options.entryModuleFileName}.ts`;

  const exportName = options.standalone ? 'Routes' : 'Module';

  addTsConfigPath(tree, `${options.appName.replace(/-/g, '_')}/${exportName}`, [
    joinPathFragments(project.root, exportPath),
  ]);
}

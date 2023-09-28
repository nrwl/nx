import type { Tree } from '@nx/devkit';
import type { Schema } from '../schema';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';

export function setupTspathForRemote(tree: Tree, options: Schema) {
  const project = readProjectConfiguration(tree, options.appName);

  const exportPath = options.standalone
    ? `./src/app/remote-entry/entry.routes.ts`
    : `./src/app/remote-entry/entry.module.ts`;

  const exportName = options.standalone ? 'Routes' : 'Module';

  addTsConfigPath(tree, `${options.appName}/${exportName}`, [
    joinPathFragments(project.root, exportPath),
  ]);
}

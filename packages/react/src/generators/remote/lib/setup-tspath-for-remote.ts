import type { Tree } from '@nx/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';
import { maybeJs } from '../../../utils/maybe-js';
import { NormalizedSchema } from '../../application/schema';

export function setupTspathForRemote(tree: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(tree, options.projectName);

  const exportPath = maybeJs(options, './src/remote-entry.ts');

  const exportName = 'Module';

  addTsConfigPath(tree, `${options.projectName}/${exportName}`, [
    joinPathFragments(project.root, exportPath),
  ]);
}

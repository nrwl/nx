import {
  formatFiles,
  getProjects,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { join } from 'path';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const config of projects.values()) {
    const swcrcPath = join(config.root, '.swcrc');
    if (!tree.exists(swcrcPath)) continue;
    const json = readJson(tree, swcrcPath);
    // No longer need strict or noInterop for es6 modules
    // See: https://github.com/swc-project/swc/commit/7e8d72d
    if (
      json.module?.type === 'es6' &&
      (json.module?.strict || json.module?.noInterop)
    ) {
      delete json.module.noInterop;
      delete json.module.strict;
      writeJson(tree, swcrcPath, json);
    }
  }

  await formatFiles(tree);
}

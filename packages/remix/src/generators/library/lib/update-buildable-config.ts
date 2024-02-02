import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';

export function updateBuildableConfig(tree: Tree, name: string) {
  // Nest dist under project root to we can link it
  const project = readProjectConfiguration(tree, name);
  project.targets.build.options = {
    ...project.targets.build.options,
    format: ['cjs'],
    outputPath: joinPathFragments(project.root, 'dist'),
  };
  updateProjectConfiguration(tree, name, project);

  // Point to nested dist for yarn/npm/pnpm workspaces
  updateJson(tree, joinPathFragments(project.root, 'package.json'), (json) => {
    json.main = './dist/index.cjs.js';
    json.typings = './dist/index.d.ts';
    return json;
  });
}

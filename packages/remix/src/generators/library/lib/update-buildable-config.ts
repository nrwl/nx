import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { RemixLibraryOptions } from './normalize-options';

export function updateBuildableConfig(
  tree: Tree,
  options: RemixLibraryOptions
) {
  if (options.isUsingTsSolutionConfig) {
    return;
  }

  // Nest dist under project root to we can link it
  const project = readProjectConfiguration(tree, options.projectName);
  project.targets.build.options = {
    ...project.targets.build.options,
    format: ['cjs'],
    outputPath: joinPathFragments(project.root, 'dist'),
  };
  updateProjectConfiguration(tree, options.projectName, project);

  // Point to nested dist for yarn/npm/pnpm workspaces
  updateJson(tree, joinPathFragments(project.root, 'package.json'), (json) => {
    json.main = './dist/index.cjs.js';
    json.typings = './dist/index.d.ts';
    return json;
  });
}

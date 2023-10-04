import type { WebWorkerGeneratorOptions } from '../schema';
import type { Tree } from '@nx/devkit';
import {
  getProjects,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';

export function normalizeOptions(
  tree: Tree,
  options: WebWorkerGeneratorOptions
): WebWorkerGeneratorOptions {
  if (!getProjects(tree).has(options.project)) {
    throw new Error(`Project '${options.project}' does not exist!`);
  }

  const { projectType, sourceRoot, root } = readProjectConfiguration(
    tree,
    options.project
  );
  if (projectType !== 'application') {
    throw new Error(
      `Web Worker can only be added to an application. Project '${options.project}' is a library.`
    );
  }

  const path =
    options.path ?? sourceRoot
      ? joinPathFragments(sourceRoot, 'app')
      : joinPathFragments(root, 'src', 'app');

  if (!tree.exists(path)) {
    throw new Error(`Path '${options.path}' does not exist!`);
  }

  return {
    ...options,
    path,
    snippet: options.snippet ?? true,
  };
}

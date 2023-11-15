import type { Tree } from '@nx/devkit';
import { getProjects, readProjectConfiguration } from '@nx/devkit';
import { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  if (!getProjects(tree).has(options.project)) {
    throw new Error(
      `Could not find project '${options.project}'. Please ensure the project name is correct and exists.`
    );
  }

  const project = readProjectConfiguration(tree, options.project);
  if (project.projectType !== 'application') {
    throw new Error(
      `NgRx Root Stores can only be added to applications, please ensure the project you use is an application.`
    );
  }

  if (!options.minimal && !options.name) {
    throw new Error(
      `If generating a global feature state with your root store, you must provide a name for it with '--name'.`
    );
  }
}

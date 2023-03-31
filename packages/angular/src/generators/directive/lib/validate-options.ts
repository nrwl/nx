import type { Tree } from '@nrwl/devkit';
import { getProjects } from '@nrwl/devkit';
import { checkPathUnderProjectRoot } from '../../utils/path';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  const projects = getProjects(tree);
  if (!projects.has(options.project)) {
    throw new Error(`Project "${options.project}" does not exist!`);
  }

  checkPathUnderProjectRoot(tree, options.project, options.path);
}

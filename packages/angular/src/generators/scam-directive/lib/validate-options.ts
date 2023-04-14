import type { Tree } from '@nx/devkit';
import { checkPathUnderProjectRoot } from '../../utils/path';
import { validateProject } from '../../utils/validations';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  checkPathUnderProjectRoot(tree, options.project, options.path);
}

import type { Tree } from '@nx/devkit';
import {
  validateProject,
  validateStandaloneOption,
} from '../../utils/validations';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  validateStandaloneOption(tree, options.standalone);
}

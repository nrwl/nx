import type { Tree } from '@nx/devkit';
import {
  validatePathIsUnderProjectRoot,
  validateProject,
  validateStandaloneOption,
} from '../../utils/validations';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  validatePathIsUnderProjectRoot(tree, options.project, options.path);
  validateStandaloneOption(tree, options.standalone);
}

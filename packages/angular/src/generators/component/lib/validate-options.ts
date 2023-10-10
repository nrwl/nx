import type { Tree } from '@nx/devkit';
import { validateStandaloneOption } from '../../utils/validations';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  validateStandaloneOption(tree, options.standalone);
}

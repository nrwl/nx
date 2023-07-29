import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import { directiveGenerator } from '../directive/directive';
import { exportScam } from '../utils/export-scam';
import {
  convertDirectiveToScam,
  normalizeOptions,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function scamDirectiveGenerator(tree: Tree, rawOptions: Schema) {
  validateOptions(tree, rawOptions);

  const { inlineScam, ...directiveOptions } = rawOptions;
  await directiveGenerator(tree, {
    ...directiveOptions,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  const options = normalizeOptions(tree, rawOptions);
  convertDirectiveToScam(tree, options);
  exportScam(tree, options);

  await formatFiles(tree);
}

export default scamDirectiveGenerator;

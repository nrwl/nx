import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import { directiveGenerator } from '../directive/directive';
import { exportScam } from '../utils/export-scam';
import { convertDirectiveToScam, normalizeOptions } from './lib';
import type { Schema } from './schema';

export async function scamDirectiveGenerator(tree: Tree, rawOptions: Schema) {
  const options = await normalizeOptions(tree, rawOptions);
  await directiveGenerator(tree, {
    ...options,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  convertDirectiveToScam(tree, options);
  exportScam(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default scamDirectiveGenerator;

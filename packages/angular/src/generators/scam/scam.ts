import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import { componentGenerator } from '../component/component';
import { exportScam } from '../utils/export-scam';
import { convertComponentToScam, normalizeOptions } from './lib';
import type { Schema } from './schema';

export async function scamGenerator(tree: Tree, rawOptions: Schema) {
  const options = await normalizeOptions(tree, rawOptions);
  await componentGenerator(tree, {
    ...options,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  convertComponentToScam(tree, options);
  exportScam(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default scamGenerator;

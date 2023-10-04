import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import { componentGenerator } from '../component/component';
import { exportScam } from '../utils/export-scam';
import {
  convertComponentToScam,
  normalizeOptions,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function scamGenerator(tree: Tree, rawOptions: Schema) {
  validateOptions(tree, rawOptions);

  const { inlineScam, ...generatorOptions } = rawOptions;
  await componentGenerator(tree, {
    ...generatorOptions,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  const options = normalizeOptions(tree, rawOptions);
  convertComponentToScam(tree, options);
  exportScam(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default scamGenerator;

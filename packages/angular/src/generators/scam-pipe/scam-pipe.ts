import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { pipeGenerator } from '../pipe/pipe';
import { exportScam } from '../utils/export-scam';
import { convertPipeToScam, normalizeOptions, validateOptions } from './lib';
import type { Schema } from './schema';

export async function scamPipeGenerator(tree: Tree, rawOptions: Schema) {
  validateOptions(tree, rawOptions);

  const { inlineScam, ...pipeOptions } = rawOptions;
  await pipeGenerator(tree, {
    ...pipeOptions,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  const options = normalizeOptions(tree, rawOptions);
  convertPipeToScam(tree, options);
  exportScam(tree, options);

  await formatFiles(tree);
}

export default scamPipeGenerator;

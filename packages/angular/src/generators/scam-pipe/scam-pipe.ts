import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import { pipeGenerator } from '../pipe/pipe';
import { exportScam } from '../utils/export-scam';
import { convertPipeToScam, normalizeOptions } from './lib';
import type { Schema } from './schema';

export async function scamPipeGenerator(tree: Tree, rawOptions: Schema) {
  const options = await normalizeOptions(tree, rawOptions);
  await pipeGenerator(tree, {
    ...options,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
    // options are already normalize, use them as is
    nameAndDirectoryFormat: 'as-provided',
  });

  convertPipeToScam(tree, options);
  exportScam(tree, options);

  await formatFiles(tree);
}

export default scamPipeGenerator;

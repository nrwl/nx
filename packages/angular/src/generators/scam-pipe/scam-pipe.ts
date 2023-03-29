import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  normalizePath,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { exportScam } from '../utils/export-scam';
import { getPipeFileInfo } from '../utils/file-info';
import { pathStartsWith } from '../utils/path';
import { convertPipeToScam, normalizeOptions } from './lib';
import type { Schema } from './schema';
import { pipeGenerator } from '../pipe/pipe';

export async function scamPipeGenerator(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const { inlineScam, projectSourceRoot, ...pipeOptions } = options;

  checkPathUnderProjectRoot(tree, options);

  await pipeGenerator(tree, {
    ...pipeOptions,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  const pipeFileInfo = getPipeFileInfo(tree, options);
  convertPipeToScam(tree, pipeFileInfo, options);
  exportScam(tree, pipeFileInfo, options);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, options: Partial<Schema>) {
  if (!options.path) {
    return;
  }

  const { root } = readProjectConfiguration(tree, options.project);

  let pathToPipe = normalizePath(options.path);
  pathToPipe = pathToPipe.startsWith('/') ? pathToPipe.slice(1) : pathToPipe;

  if (!pathStartsWith(pathToPipe, root)) {
    throw new Error(
      `The path provided for the SCAM (${options.path}) does not exist under the project root (${root}).`
    );
  }
}

export default scamPipeGenerator;

import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  normalizePath,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { exportScam } from '../utils/export-scam';
import { getDirectiveFileInfo } from '../utils/file-info';
import { pathStartsWith } from '../utils/path';
import { convertDirectiveToScam, normalizeOptions } from './lib';
import type { Schema } from './schema';
import directiveGenerator from '../directive/directive';

export async function scamDirectiveGenerator(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const { inlineScam, projectSourceRoot, ...directiveOptions } = options;

  checkPathUnderProjectRoot(tree, options);

  await directiveGenerator(tree, {
    ...directiveOptions,
    skipImport: true,
    export: false,
    standalone: false,
    skipFormat: true,
  });

  const pipeFileInfo = getDirectiveFileInfo(tree, options);
  convertDirectiveToScam(tree, pipeFileInfo, options);
  exportScam(tree, pipeFileInfo, options);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, options: Partial<Schema>) {
  if (!options.path) {
    return;
  }

  const { root } = readProjectConfiguration(tree, options.project);

  let pathToDirective = normalizePath(options.path);
  pathToDirective = pathToDirective.startsWith('/')
    ? pathToDirective.slice(1)
    : pathToDirective;

  if (!pathStartsWith(pathToDirective, root)) {
    throw new Error(
      `The path provided for the SCAM (${options.path}) does not exist under the project root (${root}).`
    );
  }
}

export default scamDirectiveGenerator;

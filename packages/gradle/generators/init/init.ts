import { convertNxGenerator, generateFiles, Tree } from '@nx/devkit';
import * as path from 'path';
import { InitGeneratorSchema } from './schema';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  // add settings.gradle at workspace root
  generateFiles(
    tree,
    path.join(__dirname, 'files/settings', options.buildScriptDSL),
    '.',
    options
  );

  // add gradle files at workspace root
  generateFiles(tree, path.join(__dirname, 'files/root'), '.', options);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);

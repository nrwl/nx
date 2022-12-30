import { formatFiles, Tree } from '@nrwl/devkit';
import {
  addFiles,
  addPathMapping,
  normalizeOptions,
  updateLintingFilePatterns,
} from './lib';
import { GeneratorOptions } from './schema';

export async function librarySecondaryEntryPointGenerator(
  tree: Tree,
  rawOptions: GeneratorOptions
) {
  const options = normalizeOptions(tree, rawOptions);

  addFiles(tree, options);
  addPathMapping(tree, options);
  updateLintingFilePatterns(tree, options);

  await formatFiles(tree);
}

export default librarySecondaryEntryPointGenerator;

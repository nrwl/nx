import { formatFiles, Tree } from '@nx/devkit';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import {
  addFiles,
  addPathMapping,
  normalizeOptions,
  updateTsConfigIncludedFiles,
} from './lib';
import { GeneratorOptions } from './schema';

export async function librarySecondaryEntryPointGenerator(
  tree: Tree,
  rawOptions: GeneratorOptions
) {
  assertSupportedAngularVersion(tree);
  const options = normalizeOptions(tree, rawOptions);

  addFiles(tree, options);
  addPathMapping(tree, options);
  updateTsConfigIncludedFiles(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default librarySecondaryEntryPointGenerator;

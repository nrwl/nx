import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { Schema } from './schema';
import { swcCoreVersion, swcHelpersVersion } from '@nx/js/src/utils/versions';
import {
  nxVersion,
  swcLoaderVersion,
  tsLibVersion,
} from '../../utils/versions';
import { addBabelInputs } from '@nx/js/src/utils/add-babel-inputs';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback;

  if (schema.compiler === 'swc') {
    task = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/rollup': nxVersion,
        '@swc/helpers': swcHelpersVersion,
        '@swc/core': swcCoreVersion,
        'swc-loader': swcLoaderVersion,
      }
    );
  } else {
    task = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/rollup': nxVersion,
        tslib: tsLibVersion,
      }
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rollupInitGenerator;

export const rollupInitSchematic = convertNxGenerator(rollupInitGenerator);

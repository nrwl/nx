import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback = () => {};

  if (!schema.skipPackageJson) {
    task = addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/rollup': nxVersion },
      undefined,
      schema.keepExistingVersions
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rollupInitGenerator;

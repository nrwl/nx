import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { esbuildVersion } from '@nx/js/src/utils/versions';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

export async function esbuildInitGenerator(tree: Tree, schema: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/esbuild': nxVersion,
        esbuild: esbuildVersion,
      },
      undefined,
      schema.keepExistingVersions
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default esbuildInitGenerator;

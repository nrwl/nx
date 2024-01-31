import { GeneratorCallback, Tree } from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';

import { createNodes } from '../../plugins/plugin';
import { InitSchema } from './schema';
import { addPlugin, updateDependencies } from './lib/utils';

export async function nuxtInitGenerator(host: Tree, schema: InitSchema) {
  addPlugin(host);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(host, createNodes);
  }

  return installTask;
}

export default nuxtInitGenerator;

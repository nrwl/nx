import { GeneratorCallback, Tree } from '@nx/devkit';

import { InitSchema } from './schema';
import { addPlugin, updateDependencies } from './lib/utils';

export async function nuxtInitGenerator(host: Tree, schema: InitSchema) {
  addPlugin(host);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  return installTask;
}

export default nuxtInitGenerator;

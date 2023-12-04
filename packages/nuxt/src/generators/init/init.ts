import { GeneratorCallback, runTasksInSerial, Tree } from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import { InitSchema } from './schema';
import { addPlugin, updateDependencies } from './lib/utils';

export async function nuxtInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
      skipFormat: true,
    })
  );

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host, schema);
    tasks.push(installTask);
  }

  addPlugin(host);

  return runTasksInSerial(...tasks);
}

export default nuxtInitGenerator;

import { formatFiles, GeneratorCallback, Tree } from '@nx/devkit';

import { runTasksInSerial } from '@nx/devkit';
import applicationGenerator from '../application/application.impl';
import setupGenerator from '../setup/setup.impl';
import { normalizeOptions } from './lib/normalize-options';
import { RemixGeneratorSchema } from './schema';

export default async function (tree: Tree, _options: RemixGeneratorSchema) {
  const options = normalizeOptions(tree, _options);
  const tasks: GeneratorCallback[] = [];

  const setupGenTask = await setupGenerator(tree);
  tasks.push(setupGenTask);

  const appGenTask = await applicationGenerator(tree, {
    name: options.appName,
    tags: options.tags,
    skipFormat: true,
    rootProject: true,
    unitTestRunner: options.unitTestRunner ?? 'vitest',
    e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    js: options.js ?? false,
    addPlugin: process.env.NX_ADD_PLUGINS !== 'false',
  });
  tasks.push(appGenTask);

  tree.delete('apps');
  tree.delete('libs');

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

import { formatFiles, runTasksInSerial, Tree } from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import detoxInitGenerator from '../init/init';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { addLinting } from './lib/add-linting';
import { addProject } from './lib/add-project';
import { createFiles } from './lib/create-files';
import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from './lib/ensure-dependencies';

export async function detoxApplicationGenerator(host: Tree, schema: Schema) {
  return await detoxApplicationGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function detoxApplicationGeneratorInternal(
  host: Tree,
  schema: Schema
) {
  const jsInitTask = await jsInitGenerator(host, {
    skipFormat: true,
    addTsPlugin:
      process.env.NX_ADD_PLUGINS !== 'false' &&
      process.env.NX_ADD_TS_PLUGIN !== 'false',
  });

  const options = await normalizeOptions(host, schema);

  const initTask = await detoxInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  createFiles(host, options);
  addProject(host, options);
  addGitIgnoreEntry(host, options);

  const lintingTask = await addLinting(host, options);
  const depsTask = ensureDependencies(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(jsInitTask, initTask, lintingTask, depsTask);
}

export default detoxApplicationGenerator;

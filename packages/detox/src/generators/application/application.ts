import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';

import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import detoxInitGenerator from '../init/init';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { addLinting } from './lib/add-linting';
import { addProject } from './lib/add-project';
import { createFiles } from './lib/create-files';
import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';

export async function detoxApplicationGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await detoxInitGenerator(host, {
    skipFormat: true,
  });
  createFiles(host, options);
  addProject(host, options);
  addGitIgnoreEntry(host, options);

  const lintingTask = await addLinting(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initTask, lintingTask);
}

export default detoxApplicationGenerator;
export const detoxApplicationSchematic = convertNxGenerator(
  detoxApplicationGenerator
);

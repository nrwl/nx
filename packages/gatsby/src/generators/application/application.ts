import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { gatsbyInitGenerator } from '../init/init';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addLinting } from './lib/add-linting';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addStyleDependencies } from '../../utils/styles';
import { updateJestConfig } from './lib/update-jest-config';
import { addPrettierIgnoreEntry } from './lib/add-prettier-ignore-entry';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { setDefaults } from './lib/set-defaults';

export async function applicationGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await gatsbyInitGenerator(host, {
    ...options,
    skipFormat: true,
  });

  createApplicationFiles(host, options);
  addProject(host, options);
  const styledTask = addStyleDependencies(host, options.style);
  const lintTask = await addLinting(host, options);
  const cypressTask = await addCypress(host, options);
  const jestTask = await addJest(host, options);
  updateJestConfig(host, options);
  addPrettierIgnoreEntry(host, options);
  addGitIgnoreEntry(host, options);

  setDefaults(host, options);
  await formatFiles(host);

  return runTasksInSerial(
    initTask,
    styledTask,
    lintTask,
    cypressTask,
    jestTask
  );
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);

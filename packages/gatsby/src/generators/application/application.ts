import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';

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

export async function applicationGenerator(host: Tree, schema: Schema) {
  let installTask: GeneratorCallback;
  const options = normalizeOptions(schema);

  installTask = await gatsbyInitGenerator(host, {
    ...options,
    skipFormat: true,
  });

  createApplicationFiles(host, options);
  installTask = addStyleDependencies(host, options.style) || installTask;
  addProject(host, options), await addLinting(host, options);
  installTask = (await addCypress(host, options)) || installTask;
  installTask = (await addJest(host, options)) || installTask;
  updateJestConfig(host, options);
  addPrettierIgnoreEntry(host, options);
  addGitIgnoreEntry(host, options);
  await formatFiles(host);

  return installTask;
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);

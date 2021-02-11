import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';

import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { createNextServerFiles } from './lib/create-next-server-files';
import { setDefaults } from './lib/set-defaults';
import { updateJestConfig } from './lib/update-jest-config';
import { updateNxJson } from './lib/update-nx-json';
import { nextInitGenerator } from '../init/init';
import { addStyleDependencies } from '../../utils/styles';
import { addLinting } from './lib/add-linting';

export async function applicationGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  await nextInitGenerator(host, { ...options, skipFormat: true });
  createApplicationFiles(host, options);
  createNextServerFiles(host, options);
  updateNxJson(host, options);
  addProject(host, options);
  await addCypress(host, options);
  await addJest(host, options);
  await addLinting(host, options);
  updateJestConfig(host, options);
  addStyleDependencies(host, options.style);
  setDefaults(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export const applicationSchematic = convertNxGenerator(applicationGenerator);

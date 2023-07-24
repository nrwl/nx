import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { addE2e } from './lib/add-e2e';
import { addJest } from './lib/add-jest';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { setDefaults } from './lib/set-defaults';
import { updateJestConfig } from './lib/update-jest-config';
import { nextInitGenerator } from '../init/init';
import { addStyleDependencies } from '../../utils/styles';
import { addLinting } from './lib/add-linting';
import { customServerGenerator } from '../custom-server/custom-server';
import { updateCypressTsConfig } from './lib/update-cypress-tsconfig';
import { showPossibleWarnings } from './lib/show-possible-warnings';

export async function applicationGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(host, schema);

  showPossibleWarnings(host, options);

  const nextTask = await nextInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(nextTask);

  createApplicationFiles(host, options);
  addProject(host, options);

  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);

  const jestTask = await addJest(host, options);
  tasks.push(jestTask);

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  const styledTask = addStyleDependencies(host, {
    style: options.style,
    swc: !host.exists(joinPathFragments(options.appProjectRoot, '.babelrc')),
  });
  tasks.push(styledTask);

  updateJestConfig(host, options);
  updateCypressTsConfig(host, options);
  setDefaults(host, options);

  if (options.customServer) {
    await customServerGenerator(host, {
      project: options.name,
      compiler: options.swc ? 'swc' : 'tsc',
    });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export const applicationSchematic = convertNxGenerator(applicationGenerator);

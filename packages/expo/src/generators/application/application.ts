import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  convertNxGenerator,
  Tree,
  formatFiles,
  joinPathFragments,
  GeneratorCallback,
} from '@nrwl/devkit';

import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import { runSymlink } from '../../utils/symlink-task';

import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { addDetox } from './lib/add-detox';
import { createApplicationFiles } from './lib/create-application-files';
import { Schema } from './schema';

export async function expoApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(schema);

  createApplicationFiles(host, options);
  addProject(host, options);

  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  const lintTask = await addLinting(
    host,
    options.projectName,
    options.appProjectRoot,
    [joinPathFragments(options.appProjectRoot, 'tsconfig.app.json')],
    options.linter,
    options.setParserOptionsProject
  );
  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.projectName,
    options.appProjectRoot,
    options.js
  );
  const detoxTask = await addDetox(host, options);
  const symlinkTask = runSymlink(host.root, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initTask, lintTask, jestTask, detoxTask, symlinkTask);
}

export default expoApplicationGenerator;
export const expoApplicationSchematic = convertNxGenerator(
  expoApplicationGenerator
);

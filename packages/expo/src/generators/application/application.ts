import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import { runSymlink } from '../../utils/symlink-task';
import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';

import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addEasScripts } from './lib/add-eas-scripts';
import { addDetox } from './lib/add-detox';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { initRootBabelConfig } from '../../utils/init-root-babel-config';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';

export async function expoApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await expoApplicationGeneratorInternal(host, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function expoApplicationGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(host, schema);

  const tasks: GeneratorCallback[] = [];
  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  tasks.push(initTask);
  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }
  initRootBabelConfig(host);

  createApplicationFiles(host, options);
  addProject(host, options);

  const lintTask = await addLinting(host, {
    ...options,
    projectRoot: options.appProjectRoot,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
  });
  tasks.push(lintTask);

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.projectName,
    options.appProjectRoot,
    options.js,
    options.skipPackageJson,
    options.addPlugin
  );
  tasks.push(jestTask);
  const detoxTask = await addDetox(host, options);
  tasks.push(detoxTask);
  const symlinkTask = runSymlink(host.root, options.appProjectRoot);
  tasks.push(symlinkTask);
  addEasScripts(host);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default expoApplicationGenerator;

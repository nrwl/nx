import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Schema } from './schema';
import { runPodInstall } from '../../utils/pod-install-task';
import { runChmod } from '../../utils/chmod-task';
import { runSymlink } from '../../utils/symlink-task';
import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import {
  convertNxGenerator,
  Tree,
  formatFiles,
  joinPathFragments,
  GeneratorCallback,
} from '@nrwl/devkit';
import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { join } from 'path';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addDetox } from './lib/add-detox';

export async function reactNativeApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(host, schema);

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
    options.appProjectRoot
  );
  const detoxTask = await addDetox(host, options);
  const symlinkTask = runSymlink(options.appProjectRoot);
  const podInstallTask = runPodInstall(options.iosProjectRoot);
  const chmodTaskGradlew = runChmod(
    join(options.androidProjectRoot, 'gradlew'),
    0o775
  );
  const chmodTaskGradlewBat = runChmod(
    join(options.androidProjectRoot, 'gradlew.bat'),
    0o775
  );

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(
    initTask,
    lintTask,
    jestTask,
    detoxTask,
    symlinkTask,
    podInstallTask,
    chmodTaskGradlew,
    chmodTaskGradlewBat
  );
}

export default reactNativeApplicationGenerator;
export const reactNativeApplicationSchematic = convertNxGenerator(
  reactNativeApplicationGenerator
);

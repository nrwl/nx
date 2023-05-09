import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { runPodInstall } from '../../utils/pod-install-task';
import { runSymlink } from '../../utils/symlink-task';
import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import { chmodAndroidGradlewFilesTask } from '../../utils/chmod-android-gradle-files';

import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addDetox } from './lib/add-detox';
import { Schema } from './schema';

export async function reactNativeApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(host, schema);

  createApplicationFiles(host, options);
  addProject(host, options);

  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  const lintTask = await addLinting(host, {
    ...options,
    projectRoot: options.appProjectRoot,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
  });

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.projectName,
    options.appProjectRoot,
    options.js,
    options.skipPackageJson
  );
  const detoxTask = await addDetox(host, options);
  const symlinkTask = runSymlink(host.root, options.appProjectRoot);
  const podInstallTask = runPodInstall(
    joinPathFragments(host.root, options.iosProjectRoot),
    options.install
  );
  const chmodTaskGradlew = chmodAndroidGradlewFilesTask(
    joinPathFragments(host.root, options.androidProjectRoot)
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
    chmodTaskGradlew
  );
}

export default reactNativeApplicationGenerator;
export const reactNativeApplicationSchematic = convertNxGenerator(
  reactNativeApplicationGenerator
);

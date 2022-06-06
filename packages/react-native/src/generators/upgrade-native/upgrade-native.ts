/**
 * This function is a destructive command that replace React Native iOS and Android code with latest.
 * It would replace the Android and iOS folder entirely.
 */
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { UpgradeNativeConfigureSchema } from './schema';
import {
  convertNxGenerator,
  Tree,
  joinPathFragments,
  GeneratorCallback,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';
import { createNativeFiles } from './lib/create-native-files';
import { existsSync, removeSync } from 'fs-extra';

import { runPodInstall } from '../../utils/pod-install-task';
import { runChmod } from '../../utils/chmod-task';

export async function reactNativeUpgradeNativeGenerator(
  host: Tree,
  schema: UpgradeNativeConfigureSchema
): Promise<GeneratorCallback> {
  const { projectType, root } = readProjectConfiguration(host, schema.name);
  const iosProjectRoot = joinPathFragments(host.root, root, 'ios');
  const androidProjectRoot = joinPathFragments(host.root, root, 'android');

  if (
    projectType !== 'application' ||
    !existsSync(iosProjectRoot) ||
    !existsSync(androidProjectRoot)
  ) {
    throw new Error(`Could not upgrade React Native code for ${schema.name}`);
  }

  removeSync(iosProjectRoot);
  removeSync(androidProjectRoot);

  createNativeFiles(host, schema, root);

  const podInstallTask = runPodInstall(iosProjectRoot, schema.install);
  const chmodTaskGradlew = runChmod(join(androidProjectRoot, 'gradlew'), 0o775);
  const chmodTaskGradlewBat = runChmod(
    join(androidProjectRoot, 'gradlew.bat'),
    0o775
  );

  return runTasksInSerial(
    podInstallTask,
    chmodTaskGradlew,
    chmodTaskGradlewBat
  );
}

export default reactNativeUpgradeNativeGenerator;
export const reactNativeUpgradeNativeSchematic = convertNxGenerator(
  reactNativeUpgradeNativeGenerator
);

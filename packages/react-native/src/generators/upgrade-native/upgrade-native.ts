/**
 * This function is a destructive command that replace React Native iOS and Android code with latest.
 * It would replace the Android and iOS folder entirely.
 */

import {
  convertNxGenerator,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { existsSync } from 'fs';

import { runPodInstall } from '../../utils/pod-install-task';
import { chmodAndroidGradlewFilesTask } from '../../utils/chmod-android-gradle-files';

import { createNativeFiles } from './lib/create-native-files';
import { UpgradeNativeConfigureSchema } from './schema';

export async function reactNativeUpgradeNativeGenerator(
  host: Tree,
  schema: UpgradeNativeConfigureSchema
): Promise<GeneratorCallback> {
  const { projectType, root: appProjectRoot } = readProjectConfiguration(
    host,
    schema.name
  );
  const iosProjectRoot = joinPathFragments(host.root, appProjectRoot, 'ios');
  const androidProjectRoot = joinPathFragments(
    host.root,
    appProjectRoot,
    'android'
  );

  if (
    projectType !== 'application' ||
    !existsSync(iosProjectRoot) ||
    !existsSync(androidProjectRoot)
  ) {
    throw new Error(`Could not upgrade React Native code for ${schema.name}`);
  }

  createNativeFiles(host, schema, appProjectRoot);

  const podInstallTask = runPodInstall(iosProjectRoot, schema.install);
  const chmodTaskGradlew = chmodAndroidGradlewFilesTask(androidProjectRoot);

  return runTasksInSerial(podInstallTask, chmodTaskGradlew);
}

export default reactNativeUpgradeNativeGenerator;
export const reactNativeUpgradeNativeSchematic = convertNxGenerator(
  reactNativeUpgradeNativeGenerator
);

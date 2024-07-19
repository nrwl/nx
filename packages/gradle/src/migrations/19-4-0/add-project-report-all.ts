import { Tree } from '@nx/devkit';
import { addBuildGradleFileNextToSettingsGradle } from '../../generators/init/init';

/**
 * This migration adds task `projectReportAll` to build.gradle files
 */
export default async function update(tree: Tree) {
  await addBuildGradleFileNextToSettingsGradle(tree);
}

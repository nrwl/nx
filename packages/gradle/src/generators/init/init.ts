import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  globAsync,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { dirname, join, basename } from 'path';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!options.skipPackageJson && tree.exists('package.json')) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/gradle': nxVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }
  await addBuildGradleFileNextToSettingsGradle(tree);
  await disableConfigurationCacheProperty(tree);
  addPlugin(tree);
  updateNxJsonConfiguration(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!hasGradlePlugin(tree)) {
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/gradle',
      options: {
        testTargetName: 'test',
        classesTargetName: 'classes',
        buildTargetName: 'build',
      },
    });
    updateNxJson(tree, nxJson);
  }
}

/**
 * This function creates and populate build.gradle file next to the settings.gradle file.
 */
export async function addBuildGradleFileNextToSettingsGradle(tree: Tree) {
  const settingsGradleFiles = await globAsync(tree, [
    '**/settings.gradle?(.kts)',
  ]);
  settingsGradleFiles.forEach((settingsGradleFile) => {
    addCreateNodesPluginToBuildGradle(settingsGradleFile, tree);
  });
}

/**
 * - creates a build.gradle file next to the settings.gradle file if it does not exist.
 * - adds the createNodes plugin to the build.gradle file if it does not exist.
 */
function addCreateNodesPluginToBuildGradle(
  settingsGradleFile: string,
  tree: Tree
) {
  const filename = basename(settingsGradleFile);
  let gradleFilePath = 'build.gradle';
  if (filename.endsWith('.kts')) {
    gradleFilePath = 'build.gradle.kts';
  }
  gradleFilePath = join(dirname(settingsGradleFile), gradleFilePath);
  let buildGradleContent = '';
  if (!tree.exists(gradleFilePath)) {
    tree.write(gradleFilePath, buildGradleContent); // create a build.gradle file near settings.gradle file if it does not exist
  } else {
    buildGradleContent = tree.read(gradleFilePath).toString();
  }

  const nodesPlugin = filename.endsWith('.kts')
    ? ` id("dev.nx.gradle.native") version("+")`
    : ` id "dev.nx.gradle.native" version "+"`;
  if (buildGradleContent.includes('plugins {')) {
    if (!buildGradleContent.includes('"dev.nx.gradle.native"')) {
      buildGradleContent = buildGradleContent.replace(
        'plugins {',
        `plugins {
    ${nodesPlugin}`
      );
    }
  } else {
    buildGradleContent += `\n\rplugins {
    ${nodesPlugin}
}`;
  }

  if (buildGradleContent) {
    tree.write(gradleFilePath, buildGradleContent);
  }
}

/**
 * Need to set org.gradle.configuration-cache=false for createNodes task to not throw an error.
 * @param tree
 */
export async function disableConfigurationCacheProperty(tree: Tree) {
  const gradlePropertiesFiles = await globAsync(tree, ['**/gradle.properties']);
  gradlePropertiesFiles.forEach((gradlePropertiesFile) => {
    const content = tree.read(gradlePropertiesFile).toString();
    if (
      content.includes('org.gradle.configuration-cache') &&
      !content.includes('org.gradle.configuration-cache=false')
    ) {
      logger.warn(
        'org.gradle.configuration-cache property is set to true. Setting it to false to avoid issues with createNodes task.'
      );
    }
  });
}

export function updateNxJsonConfiguration(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    nxJson.namedInputs = {};
  }
  const defaultFilesSet = nxJson.namedInputs.default ?? [];
  nxJson.namedInputs.default = Array.from(
    new Set([...defaultFilesSet, '{projectRoot}/**/*'])
  );
  const productionFileSet = nxJson.namedInputs.production ?? [];
  nxJson.namedInputs.production = Array.from(
    new Set([...productionFileSet, 'default', '!{projectRoot}/src/test/**/*'])
  );
  updateNxJson(tree, nxJson);
}

export default initGenerator;

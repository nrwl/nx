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

const nativePluginName = 'dev.nx.gradle';

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
    addNxProjectGraphPluginToBuildGradle(settingsGradleFile, tree);
  });
}

/**
 * - creates a build.gradle file next to the settings.gradle file if it does not exist.
 * - adds the NxProjectGraphPlugin plugin to the build.gradle file if it does not exist.
 */
function addNxProjectGraphPluginToBuildGradle(
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

  const nxProjectGraphReportPlugin = filename.endsWith('.kts')
    ? `id("${nativePluginName}") version("+")`
    : `id "${nativePluginName}" version "+"`;
  if (buildGradleContent.includes('plugins {')) {
    if (!buildGradleContent.includes(nativePluginName)) {
      buildGradleContent = buildGradleContent.replace(
        'plugins {',
        `plugins {
    ${nxProjectGraphReportPlugin}`
      );
    }
  } else {
    buildGradleContent = `plugins {
    ${nxProjectGraphReportPlugin}
}\n\r${buildGradleContent}`;
  }

  const applyNxProjectGraphReportPlugin = `plugin("${nativePluginName}")`;
  if (buildGradleContent.includes('allprojects {')) {
    if (
      !buildGradleContent.includes(`plugin("${nativePluginName}")`) &&
      !buildGradleContent.includes(`plugin('${nativePluginName}')`)
    ) {
      logger.warn(
        `Please add the ${nativePluginName} plugin to your ${gradleFilePath}:
allprojects {
  apply {
      ${applyNxProjectGraphReportPlugin}
  }
}`
      );
    }
  } else {
    buildGradleContent = `${buildGradleContent}\n\rallprojects {
    apply {
        ${applyNxProjectGraphReportPlugin}
    }
  }`;
  }

  tree.write(gradleFilePath, buildGradleContent);
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

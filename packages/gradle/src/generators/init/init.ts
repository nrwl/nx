import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { nxVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!tree.exists('settings.gradle') && !tree.exists('settings.gradle.kts')) {
    logger.warn(`Could not find 'settings.gradle' or 'settings.gradle.kts' file in your gradle workspace.
A Gradle build should contain a 'settings.gradle' or 'settings.gradle.kts' file in its root directory. It may also contain a 'build.gradle' or 'build.gradle.kts' file.
Running 'gradle init':`);
    execSync('gradle init', { stdio: 'inherit' });
  }

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

  addPlugin(tree);
  updateNxJsonConfiguration(tree);
  addProjectReportToBuildGradle(tree);

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
 * This function adds the project-report plugin to the build.gradle or build.gradle.kts file
 */
function addProjectReportToBuildGradle(tree: Tree) {
  let buildGradleFile: string;
  if (tree.exists('settings.gradle.kts')) {
    buildGradleFile = 'build.gradle.kts';
  } else if (tree.exists('settings.gradle')) {
    buildGradleFile = 'build.gradle';
  }

  let buildGradleContent = '';
  if (tree.exists(buildGradleFile)) {
    buildGradleContent = tree.read(buildGradleFile).toString();
  }
  if (buildGradleContent.includes('allprojects')) {
    if (!buildGradleContent.includes('"project-report')) {
      logger.warn(`Please add the project-report plugin to your ${buildGradleFile}:
allprojects {
  apply {
      plugin("project-report")
  }
}`);
    }
  } else {
    buildGradleContent += `\n\rallprojects {
  apply {
      plugin("project-report")
  }
}`;
    tree.write(buildGradleFile, buildGradleContent);
  }
}

function updateNxJsonConfiguration(tree: Tree) {
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
    new Set([...productionFileSet, 'default', '!{projectRoot}/test/**/*'])
  );
  updateNxJson(tree, nxJson);
}

export default initGenerator;

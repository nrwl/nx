import { globAsync, logger, Tree } from '@nx/devkit';
import { basename, dirname, join } from 'node:path';

/**
 * This migration adds task `projectReportAll` to build.gradle files
 */
export default async function update(tree: Tree) {
  await addBuildGradleFileNextToSettingsGradle(tree);
}

/**
 * This function creates and populate build.gradle file next to the settings.gradle file.
 */
export async function addBuildGradleFileNextToSettingsGradle(tree: Tree) {
  const settingsGradleFiles = await globAsync(tree, [
    '**/settings.gradle?(.kts)',
  ]);
  settingsGradleFiles.forEach((settingsGradleFile) => {
    addProjectReportToBuildGradle(settingsGradleFile, tree);
  });
}

/**
 * - creates a build.gradle file next to the settings.gradle file if it does not exist.
 * - adds the project-report plugin to the build.gradle file if it does not exist.
 * - adds a task to generate project reports for all subprojects and included builds.
 */
function addProjectReportToBuildGradle(settingsGradleFile: string, tree: Tree) {
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

  if (buildGradleContent.includes('allprojects')) {
    if (!buildGradleContent.includes('"project-report"')) {
      logger.warn(`Please add the project-report plugin to your ${gradleFilePath}:
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
  }

  if (!buildGradleContent.includes(`tasks.register("projectReportAll")`)) {
    if (gradleFilePath.endsWith('.kts')) {
      buildGradleContent += `\n\rtasks.register("projectReportAll") {
    // All project reports of subprojects
    allprojects.forEach {
        dependsOn(it.tasks.get("projectReport"))
    }

    // All projectReportAll of included builds
    gradle.includedBuilds.forEach {
        dependsOn(it.task(":projectReportAll"))
    }
}`;
    } else {
      buildGradleContent += `\n\rtasks.register("projectReportAll") {
        // All project reports of subprojects
        allprojects.forEach {
            dependsOn(it.tasks.getAt("projectReport"))
        }
    
        // All projectReportAll of included builds
        gradle.includedBuilds.forEach {
            dependsOn(it.task(":projectReportAll"))
        }
    }`;
    }
  }
  if (buildGradleContent) {
    tree.write(gradleFilePath, buildGradleContent);
  }
}

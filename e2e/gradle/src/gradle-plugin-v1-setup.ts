import {
  cleanupProject,
  createFile,
  fileExists,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { basename, dirname, join } from 'path';
import { createGradleProject } from './utils/create-gradle-project';

export interface GradlePluginV1TestSetup {
  gradleProjectName: string;
  type: 'kotlin' | 'groovy';
}

export function setupGradlePluginV1Test(
  type: 'kotlin' | 'groovy'
): GradlePluginV1TestSetup {
  const gradleProjectName = uniq('my-gradle-project');
  newProject();
  createGradleProject(gradleProjectName, type);
  runCLI(`add @nx/gradle`);
  updateJson('nx.json', (json) => {
    json.plugins.find((p) => p.plugin === '@nx/gradle').plugin =
      '@nx/gradle/plugin-v1';
    return json;
  });
  addProjectReportToBuildGradle(
    `settings.gradle${type === 'kotlin' ? '.kts' : ''}`
  );

  return {
    gradleProjectName,
    type,
  };
}

export function cleanupGradlePluginV1Test(): void {
  cleanupProject();
}

function addProjectReportToBuildGradle(settingsGradleFile: string) {
  const filename = basename(settingsGradleFile);
  let gradleFilePath = 'build.gradle';
  if (filename.endsWith('.kts')) {
    gradleFilePath = 'build.gradle.kts';
  }
  gradleFilePath = join(dirname(settingsGradleFile), gradleFilePath);
  let buildGradleContent = '';
  if (!fileExists(gradleFilePath)) {
    createFile(gradleFilePath, buildGradleContent); // create a build.gradle file near settings.gradle file if it does not exist
  } else {
    buildGradleContent = readFile(gradleFilePath).toString();
  }

  buildGradleContent += `\n\rallprojects {
  apply {
      plugin("project-report")
  }
}`;

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
  if (buildGradleContent) {
    updateFile(gradleFilePath, buildGradleContent);
  }
}

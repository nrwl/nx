import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

import { createGradleProject } from './utils/create-gradle-project';

export interface GradleSuiteContext {
  projectName: string;
  type: 'kotlin' | 'groovy';
  usePluginV1?: boolean;
}

export function setupGradleSuite(context: GradleSuiteContext) {
  beforeAll(() => {
    newProject();
    createGradleProject(context.projectName, context.type);
    runCLI(`add @nx/gradle`);
    if (context.usePluginV1) {
      updateJson('nx.json', (json) => {
        json.plugins.find((p) => p.plugin === '@nx/gradle').plugin =
          '@nx/gradle/plugin-v1';
        return json;
      });
    }
  });

  afterAll(() => cleanupProject());
}

export function addDependentApp(context: GradleSuiteContext) {
  if (context.type === 'groovy') {
    createFile(
      `app2/build.gradle`,
      `plugins {
    id 'buildlogic.groovy-application-conventions'
}

export function addProjectReportToSettings(settingsGradleFile: string) {
  const filename = basename(settingsGradleFile);
  let gradleFilePath = 'build.gradle';
  if (filename.endsWith('.kts')) {
    gradleFilePath = 'build.gradle.kts';
  }
  gradleFilePath = join(dirname(settingsGradleFile), gradleFilePath);
  let buildGradleContent = '';
  if (!fileExists(gradleFilePath)) {
    createFile(gradleFilePath, buildGradleContent);
  } else {
    buildGradleContent = readFile(gradleFilePath).toString();
  }

  buildGradleContent += `
allprojects {
  apply {
      plugin("project-report")
  }
}`;

  if (gradleFilePath.endsWith('.kts')) {
    buildGradleContent += `
tasks.register("projectReportAll") {
    allprojects.forEach {
        dependsOn(it.tasks.get("projectReport"))
    }

    gradle.includedBuilds.forEach {
        dependsOn(it.task(":projectReportAll"))
    }
}`;
  } else {
    buildGradleContent += `
tasks.register("projectReportAll") {
        allprojects.forEach {
            dependsOn(it.tasks.getAt("projectReport"))
        }

        gradle.includedBuilds.forEach {
            dependsOn(it.task(":projectReportAll"))
        }
    }`;
  }
  if (buildGradleContent) {
    updateFile(gradleFilePath, buildGradleContent);
  }
}

dependencies {
    implementation project(':app')
}`
    );
  } else {
    createFile(
      `app2/build.gradle.kts`,
      `plugins {
    id("buildlogic.kotlin-application-conventions")
}

dependencies {
    implementation(project(":app"))
}`
    );
    updateFile(`app/build.gradle.kts`, (content) => {
      content += `
tasks.register("task1"){
    println("REGISTER TASK1: This is executed during the configuration phase")
}`;
      return content;
    });
  }

  updateFile(
    `settings.gradle${context.type === 'kotlin' ? '.kts' : ''}`,
    (content) => {
      content += `
include("app2")`;
      return content;
    }
  );
}

export function configureAtomizedTests() {
  updateJson('nx.json', (json) => {
    json.plugins.find((p) => p.plugin === '@nx/gradle').options[
      'ciTestTargetName'
    ] = 'test-ci';
    return json;
  });
}

export function createGradleSuiteContext(
  type: 'kotlin' | 'groovy',
  options?: { usePluginV1?: boolean }
): GradleSuiteContext {
  return {
    projectName: uniq('my-gradle-project'),
    type,
    usePluginV1: options?.usePluginV1,
  };
}


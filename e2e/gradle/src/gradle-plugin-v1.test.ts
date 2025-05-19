import {
  checkFilesExist,
  cleanupProject,
  createFile,
  fileExists,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { basename, dirname, join } from 'path';

import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle Plugin V1', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName = uniq('my-gradle-project');
      beforeAll(() => {
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
      });
      afterAll(() => cleanupProject());

      it('should build', () => {
        const projects = runCLI(`show projects`);
        expect(projects).toContain('app');
        expect(projects).toContain('list');
        expect(projects).toContain('utilities');
        expect(projects).toContain(gradleProjectName);

        const buildOutput = runCLI('build app', { verbose: true });
        expect(buildOutput).toContain('nx run list:build');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain('nx run utilities:build');
        expect(buildOutput).toContain(':utilities:classes');

        checkFilesExist(
          `app/build/libs/app.jar`,
          `list/build/libs/list.jar`,
          `utilities/build/libs/utilities.jar`
        );
      });

      it('should track dependencies for new app', () => {
        if (type === 'groovy') {
          createFile(
            `app2/build.gradle`,
            `plugins {
    id 'buildlogic.groovy-application-conventions'
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
            content += `\r\ntasks.register("task1"){  
                println("REGISTER TASK1: This is executed during the configuration phase")
            }`;
            return content;
          });
        }
        updateFile(
          `settings.gradle${type === 'kotlin' ? '.kts' : ''}`,
          (content) => {
            content += `\r\ninclude("app2")`;
            return content;
          }
        );

        let buildOutput = runCLI('build app2', { verbose: true });
        // app2 depends on app
        expect(buildOutput).toContain('nx run app:build');
        expect(buildOutput).toContain(':app:classes');
        expect(buildOutput).toContain('nx run list:build');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain('nx run utilities:build');
        expect(buildOutput).toContain(':utilities:classes');

        checkFilesExist(
          `app2/build/libs/app2.jar`,
          `app/build/libs/app.jar`,
          `list/build/libs/list.jar`,
          `utilities/build/libs/utilities.jar`
        );
      });

      it('should run atomized test target', () => {
        updateJson('nx.json', (json) => {
          json.plugins.find((p) => p.plugin === '@nx/gradle/plugin-v1').options[
            'ciTargetName'
          ] = 'test-ci';
          return json;
        });

        expect(() => {
          runCLI('run app:test-ci--MessageUtilsTest', { verbose: true });
          runCLI('run list:test-ci--LinkedListTest', { verbose: true });
        }).not.toThrow();
      });
    }
  );
});

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

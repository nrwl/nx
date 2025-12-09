import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName = uniq('my-gradle-project');
      beforeAll(() => {
        newProject({ packages: [] });
        createGradleProject(gradleProjectName, type);
        runCLI(`add @nx/gradle`);
      });
      afterAll(() => cleanupProject());

      it('should build', () => {
        const projects = runCLI(`show projects`);
        expect(projects).toContain('app');
        expect(projects).toContain('list');
        expect(projects).toContain('utilities');
        expect(projects).toContain(gradleProjectName);

        let buildOutput = runCLI('build app', { verbose: true });
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain(':utilities:classes');

        checkFilesExist(
          `app/build/libs/app.jar`,
          `list/build/libs/list.jar`,
          `utilities/build/libs/utilities.jar`
        );

        buildOutput = runCLI('build app --batch', { verbose: true });
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain(':utilities:classes');

        const bootJarOutput = runCLI('bootJar app', { verbose: true });
        expect(bootJarOutput).toContain(':app:bootJar');
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
        expect(buildOutput).toContain(':app:classes');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain(':utilities:classes');

        checkFilesExist(`app2/build/libs/app2.jar`);

        buildOutput = runCLI('build app2 --batch', { verbose: true });
        expect(buildOutput).toContain(':app:classes');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain(':utilities:classes');
      });

      it('should run atomized test target', () => {
        updateJson('nx.json', (json) => {
          json.plugins.find((p) => p.plugin === '@nx/gradle').options[
            'ciTestTargetName'
          ] = 'test-ci';
          return json;
        });

        expect(() => {
          runCLI('run app:test-ci--MessageUtilsTest', { verbose: true });
          runCLI('run list:test-ci--LinkedListTest', { verbose: true });
        }).not.toThrow();
      });

      it('should support targetNamePrefix option', () => {
        // Update nx.json to add targetNamePrefix
        updateJson('nx.json', (nxJson) => {
          // Find the Gradle plugin - it could be a string or an object
          const pluginIndex = nxJson.plugins.findIndex(
            (p: string | { plugin: string }) =>
              p === '@nx/gradle' ||
              (typeof p === 'object' && p.plugin === '@nx/gradle')
          );

          if (pluginIndex !== -1) {
            // Convert string plugin to object with options, or update existing options
            if (typeof nxJson.plugins[pluginIndex] === 'string') {
              nxJson.plugins[pluginIndex] = {
                plugin: '@nx/gradle',
                options: {
                  targetNamePrefix: 'gradle-',
                },
              };
            } else {
              nxJson.plugins[pluginIndex].options = {
                ...nxJson.plugins[pluginIndex].options,
                targetNamePrefix: 'gradle-',
              };
            }
          }
          return nxJson;
        });

        // Reset daemon to pick up nx.json changes
        runCLI('reset');

        // Verify prefixed targets exist
        const output = runCLI('show project app --json=false');
        expect(output).toContain('gradle-build');
        expect(output).toContain('gradle-test');
        expect(output).toContain('gradle-classes');

        // Verify prefixed target works
        const buildOutput = runCLI('run app:gradle-build');
        expect(buildOutput).toContain('BUILD SUCCESSFUL');
      });

      it('should not double-prefix CI test targets when using targetNamePrefix with ciTestTargetName', () => {
        // Update nx.json to add both targetNamePrefix and ciTestTargetName
        updateJson('nx.json', (nxJson) => {
          const pluginIndex = nxJson.plugins.findIndex(
            (p: string | { plugin: string }) =>
              p === '@nx/gradle' ||
              (typeof p === 'object' && p.plugin === '@nx/gradle')
          );

          if (pluginIndex !== -1) {
            if (typeof nxJson.plugins[pluginIndex] === 'string') {
              nxJson.plugins[pluginIndex] = {
                plugin: '@nx/gradle',
                options: {
                  targetNamePrefix: 'gradle-',
                  ciTestTargetName: 'test-ci',
                },
              };
            } else {
              nxJson.plugins[pluginIndex].options = {
                ...nxJson.plugins[pluginIndex].options,
                targetNamePrefix: 'gradle-',
                ciTestTargetName: 'test-ci',
              };
            }
          }
          return nxJson;
        });

        // Reset daemon to pick up nx.json changes
        runCLI('reset');

        // Verify the CI test target has correct prefixing (not double-prefixed)
        const appOutput = runCLI('show project app --json');
        const appProject = JSON.parse(appOutput);

        // The CI test target should be prefixed once: 'gradle-test-ci'
        // NOT double-prefixed like 'gradle-test-ci-gradle-MessageUtilsTest'
        const targetNames = Object.keys(appProject.targets);
        const ciTestTargets = targetNames.filter((t) => t.includes('test-ci'));

        // Should have gradle-test-ci target(s)
        expect(ciTestTargets.some((t) => t.startsWith('gradle-test-ci'))).toBe(
          true
        );

        // Should NOT have any double-prefixed targets
        const doublePrefixed = ciTestTargets.filter((t) =>
          t.includes('gradle-test-ci-gradle-')
        );
        expect(doublePrefixed).toEqual([]);

        // Verify the correctly prefixed CI test target exists (e.g., gradle-test-ci--MessageUtilsTest)
        expect(
          targetNames.some((t) => t === 'gradle-test-ci--MessageUtilsTest')
        ).toBe(true);
      });
    }
  );
});

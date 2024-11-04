import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName = uniq('my-gradle-project');
      beforeAll(() => {
        newProject();
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
        // app depends on list and utilities
        expect(buildOutput).toContain('nx run list:build');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain('nx run utilities:build');
        expect(buildOutput).toContain(':utilities:classes');

        checkFilesExist(
          `app/build/libs/app.jar`,
          `list/build/libs/list.jar`,
          `utilities/build/libs/utilities.jar`
        );

        buildOutput = runCLI(`build ${gradleProjectName}`, { verbose: true });
        // root project depends on app, list and utilities
        expect(buildOutput).toContain('nx run app:build');
        expect(buildOutput).toContain(':app:classes');
        expect(buildOutput).toContain('nx run list:build');
        expect(buildOutput).toContain(':list:classes');
        expect(buildOutput).toContain('nx run utilities:build');
        expect(buildOutput).toContain(':utilities:classes');
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
      });
    }
  );
});

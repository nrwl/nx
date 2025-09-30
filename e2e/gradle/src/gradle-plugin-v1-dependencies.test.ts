import { checkFilesExist, createFile, runCLI, updateFile } from '@nx/e2e-utils';
import {
  setupGradlePluginV1Test,
  cleanupGradlePluginV1Test,
} from './gradle-plugin-v1-setup';

describe('Gradle Plugin V1 - Dependencies', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      beforeAll(() => {
        setupGradlePluginV1Test(type);
      });

      afterAll(() => cleanupGradlePluginV1Test());

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
    }
  );
});

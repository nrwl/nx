import { checkFilesExist, createFile, runCLI, updateFile } from '@nx/e2e-utils';
import { setupGradleTest, cleanupGradleTest } from './gradle-setup';

describe('Gradle - Dependencies', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      beforeAll(() => {
        setupGradleTest(type);
      });

      afterAll(() => cleanupGradleTest());

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
    }
  );
});

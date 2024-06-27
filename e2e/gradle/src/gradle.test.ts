import {
  checkFilesExist,
  cleanupProject,
  createFile,
  e2eConsoleLogger,
  isWindows,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import { resolve } from 'path';

describe('Gradle', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName = uniq('my-gradle-project');
      beforeAll(() => {
        newProject();
        createGradleProject(gradleProjectName, type);
      });
      afterAll(() => cleanupProject());

      it('should build', () => {
        const projects = runCLI(`show projects`);
        expect(projects).toContain('app');
        expect(projects).toContain('list');
        expect(projects).toContain('utilities');
        expect(projects).toContain(gradleProjectName);

        const buildOutput = runCLI('build app', { verbose: true });
        // app depends on list and utilities
        expect(buildOutput).toContain('nx run list:build');
        expect(buildOutput).toContain('nx run utilities:build');

        checkFilesExist(
          `app/build/libs/app.jar`,
          `list/build/libs/list.jar`,
          `utilities/build/libs/utilities.jar`
        );

        expect(() => {
          runCLI(`build ${gradleProjectName}`, { verbose: true });
        }).not.toThrow();
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
        const buildOutput = runCLI('build app2', { verbose: true });
        // app2 depends on app
        expect(buildOutput).toContain('nx run app:build');
      });
    }
  );
});

function createGradleProject(
  projectName: string,
  type: 'kotlin' | 'groovy' = 'kotlin'
) {
  e2eConsoleLogger(`Using java version: ${execSync('java -version')}`);
  const gradleCommand = isWindows()
    ? resolve(`${__dirname}/../gradlew.bat`)
    : resolve(`${__dirname}/../gradlew`);
  e2eConsoleLogger(
    'Using gradle version: ' +
      execSync(`${gradleCommand} --version`, {
        cwd: tmpProjPath(),
      })
  );
  e2eConsoleLogger(
    execSync(`${gradleCommand} help --task :init`, {
      cwd: tmpProjPath(),
    }).toString()
  );
  e2eConsoleLogger(
    runCommand(
      `${gradleCommand} init --type ${type}-application --dsl ${type} --project-name ${projectName} --package gradleProject --no-incubating --split-project`,
      {
        cwd: tmpProjPath(),
      }
    )
  );
  runCLI(`add @nx/gradle`);
}

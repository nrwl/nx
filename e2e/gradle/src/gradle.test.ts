import {
  checkFilesExist,
  cleanupProject,
  createFile,
  e2eConsoleLogger,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

describe('Gradle', () => {
  let gradleProjectName = uniq('my-gradle-project');

  beforeAll(() => {
    newProject();
    createGradleProject(gradleProjectName);
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
      `utilities/build/libs/utilities.jar`,
    );
  });

  it('should track dependencies for new app', () => {
    createFile(
      'app2/build.gradle.kts',
      `
    plugins {
        id("gradleProject.kotlin-application-conventions")
    }
    
    dependencies {
        implementation(project(":app"))
    }
      `,
    );
    updateFile(`settings.gradle.kts`, (content) => {
      content += `\r\ninclude("app2")`;
      return content;
    });
    const buildOutput = runCLI('build app2', { verbose: true });
    // app2 depends on app
    expect(buildOutput).toContain('nx run app:build');
  });
});

function createGradleProject(projectName: string) {
  e2eConsoleLogger(`Using java version: ${execSync('java --version')}`);
  e2eConsoleLogger(`Using gradle version: ${execSync('gradle --version')}`);
  e2eConsoleLogger(execSync(`gradle help --task :init`).toString());
  e2eConsoleLogger(
    runCommand(
      `gradle init --type kotlin-application --dsl kotlin --project-name ${projectName} --package gradleProject --no-incubating --split-project`,
    ),
  );
  updateJson('nx.json', (nxJson) => {
    nxJson.plugins = ['@nx/gradle'];
    return nxJson;
  });
  createFile(
    'build.gradle.kts',
    `allprojects {
      apply {
          plugin("project-report")
      }
    }`,
  );
}

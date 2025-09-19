import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle - kotlin', () => {
  let gradleProjectName = uniq('my-gradle-project');
  beforeAll(() => {
    newProject();
    createGradleProject(gradleProjectName, 'kotlin');
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

    let buildOutput = runCLI('build app2', { verbose: true });
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
    // reuse config from original test
    // ciTestTargetName is set via plugin defaults; just run atomized targets
    expect(() => {
      runCLI('run app:test-ci--MessageUtilsTest', { verbose: true });
      runCLI('run list:test-ci--LinkedListTest', { verbose: true });
    }).not.toThrow();
  });
});



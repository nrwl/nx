import {
  cleanupProject,
  createFile,
  e2eConsoleLogger,
  newProject,
  runCLI,
  runCommand,
  uniq,
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
    e2eConsoleLogger(projects);
    expect(projects).toContain('app');
    expect(projects).toContain('list');
    expect(projects).toContain('utilities');
    expect(projects).toContain(gradleProjectName);

    runCLI('build app');
    runCLI('build list');
    runCLI('build utilities');
  });
});

function createGradleProject(projectName: string) {
  e2eConsoleLogger(`Using java version: ${execSync('java --version')}`);
  e2eConsoleLogger(`Using gradle version: ${execSync('gradle --version')}`);
  e2eConsoleLogger(execSync(`gradle help --task :init`).toString());
  e2eConsoleLogger(
    runCommand(
      `gradle init --type kotlin-application --dsl kotlin --project-name ${projectName} --package gradleProject --no-incubating --split-project`
    )
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
    }`
  );
}

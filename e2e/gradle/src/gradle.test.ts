import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runCommand,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

describe('Gradle', () => {
  beforeAll(() => {
    newProject();
    createGradleProject();
  });
  afterAll(() => cleanupProject());

  it('should build', () => {
    const projects = runCLI(`show projects`);
    console.info(projects);
    expect(projects).toContain('app');
    expect(projects).toContain('list');
    expect(projects).toContain('utilities');
    expect(projects).toContain('gradleProject');

    runCLI('build app');
    runCLI('build list');
    runCLI('build utilities');
  });
});

function createGradleProject() {
  console.info(`Using java version: ${execSync('java --version')}`);
  console.info(`Using gradle version: ${execSync('gradle --version')}`);
  console.info(execSync(`gradle help --task :init`).toString());
  console.info(
    runCommand(
      `gradle init --type kotlin-application --dsl kotlin --project-name gradleProject --package gradleProject --no-incubating --split-project`
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

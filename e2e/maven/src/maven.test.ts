import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  readJson,
} from '@nx/e2e-utils';

import { createMavenProject } from './utils/create-maven-project';

describe('Maven', () => {
  let mavenProjectName = uniq('my-maven-project');

  beforeAll(() => {
    newProject({
      packages: ['@nx/maven'],
    });
    createMavenProject(mavenProjectName);
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should detect Maven projects', () => {
    const projects = runCLI(`show projects`);
    expect(projects).toContain('app');
    expect(projects).toContain('lib');
    expect(projects).toContain('utils');
    expect(projects).toContain(mavenProjectName);
  });

  it('should have proper Maven targets', () => {
    const project = JSON.parse(runCLI('show project app --json'));

    expect(project.targets).toBeDefined();
    expect(project.targets.install).toBeDefined();

    // Check that install target uses Maven command
    expect(project.targets.install.options.command).toContain('mvn install');
  });

  it('should build Maven project with dependencies', () => {
    // Build app which depends on lib, which depends on utils
    let buildOutput = runCLI('run app:install', { verbose: true });

    // Should build dependencies first
    expect(buildOutput).toContain('BUILD SUCCESS');

    checkFilesExist(
      `app/target/app-1.0.0-SNAPSHOT.jar`,
      `lib/target/lib-1.0.0-SNAPSHOT.jar`,
      `utils/target/utils-1.0.0-SNAPSHOT.jar`
    );
  });

  it('should run tests for Maven project', () => {
    const testOutput = runCLI('run utils:test', { verbose: true });
    expect(testOutput).toContain('BUILD SUCCESS');
  });

  it('should handle Maven project with complex dependencies', () => {
    // Verify that app's dependencies are tracked correctly
    runCLI('graph --file=graph.json');
    const graph = readJson('graph.json');

    // Check that dependencies exist in the graph
    const appDeps = graph.dependencies.app;
    expect(appDeps).toContainEqual({
      source: 'app',
      target: 'lib',
      type: 'static',
    });
  });
});

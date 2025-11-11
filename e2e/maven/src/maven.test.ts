import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  readJson,
  updateJson,
} from '@nx/e2e-utils';

import { createMavenProject } from './utils/create-maven-project';

describe('Maven', () => {
  let mavenProjectName = uniq('my-maven-project');

  beforeAll(async () => {
    newProject({
      preset: 'apps',
      packages: ['@nx/maven'],
    });
    await createMavenProject(mavenProjectName);
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should detect Maven projects', () => {
    console.log(readJson('nx.json'));
    const projects = runCLI(`show projects`);
    expect(projects).toContain('app');
    expect(projects).toContain('lib');
    expect(projects).toContain('utils');
    expect(projects).toContain(mavenProjectName);
  });

  it('should have proper Maven targets', () => {
    const output = runCLI('show project app --json=false');

    // Check that the project name appears
    expect(output).toContain('Name: com.example:app');

    // Check that install target appears
    expect(output).toContain('- install:');

    // Check that install-ci target appears
    expect(output).toContain('- install-ci:');
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
    const appDeps = graph.graph.dependencies['com.example:app'];
    expect(appDeps).toContainEqual({
      source: 'com.example:app',
      target: 'com.example:lib',
      type: 'static',
    });
    expect(appDeps).toContainEqual({
      source: 'com.example:app',
      target: `com.example:${mavenProjectName}`,
      type: 'static',
    });
  });

  it('should support targetNamePrefix option', () => {
    // Update nx.json to add targetNamePrefix
    updateJson('nx.json', (nxJson) => {
      // Find the Maven plugin - it could be a string or an object
      const pluginIndex = nxJson.plugins.findIndex(
        (p: string | { plugin: string }) =>
          p === '@nx/maven' ||
          (typeof p === 'object' && p.plugin === '@nx/maven')
      );

      if (pluginIndex !== -1) {
        // Convert string plugin to object with options
        nxJson.plugins[pluginIndex] = {
          plugin: '@nx/maven',
          options: {
            targetNamePrefix: 'mvn-',
          },
        };
      }
      return nxJson;
    });

    // Reset daemon to pick up nx.json changes
    runCLI('reset');

    // Verify prefixed targets exist
    const output = runCLI('show project app --json=false');
    expect(output).toContain('- mvn-install:');
    expect(output).toContain('- mvn-compile:');
    expect(output).toContain('- mvn-test:');
    expect(output).toContain('- mvn-package:');
    expect(output).toContain('- mvn-install-ci:');

    // Verify prefixed target works
    const buildOutput = runCLI('run app:mvn-compile');
    expect(buildOutput).toContain('BUILD SUCCESS');
  });
});

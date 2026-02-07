import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  readJson,
} from '@nx/e2e-utils';

import { createMavenProject } from './utils/create-maven-project';

describe('Maven with project name overrides', () => {
  let mavenProjectName = uniq('my-maven-project');

  beforeAll(async () => {
    newProject({
      preset: 'apps',
      packages: ['@nx/maven'],
    });
    // Create Maven project with custom Nx project name prefix
    // This creates project.json files with names like "custom-app", "custom-lib", "custom-utils"
    // while Maven artifactIds remain "app", "lib", "utils"
    await createMavenProject(mavenProjectName, undefined, 'custom-');
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should detect Maven projects with overridden names', () => {
    const projects = runCLI(`show projects`);
    expect(projects).toContain('custom-app');
    expect(projects).toContain('custom-lib');
    expect(projects).toContain('custom-utils');
  });

  it('should use Maven coordinates for -pl flag despite custom Nx name', () => {
    const projectJson = readJson('app/project.json');
    // The project.json has a custom name that doesn't match Maven coordinates
    expect(projectJson.name).toBe('custom-app');

    // The inferred target should have the correct Maven coordinates in options.project
    const output = runCLI('show project custom-app --json');
    const project = JSON.parse(output);
    const installTarget = project.targets['install'];
    expect(installTarget.options.project).toBe('com.example:app');
  });

  it('should build Maven project with overridden names', () => {
    // Build custom-app which depends on custom-lib -> custom-utils
    // This tests that the executor uses options.project (Maven coordinates)
    // instead of the Nx project name for the -pl flag
    const buildOutput = runCLI('run custom-app:install', { verbose: true });
    expect(buildOutput).toContain('BUILD SUCCESS');
  });
});

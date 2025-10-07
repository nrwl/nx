import {
  cleanupProject,
  createEmptyProjectDirectory,
  openInEditor,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

import { createMavenProject } from './utils/create-maven-project';

describe('Maven (Simple)', () => {
  let mavenProjectName = uniq('my-maven-project');

  beforeAll(async () => {
    createEmptyProjectDirectory(mavenProjectName);
    await createMavenProject(mavenProjectName);
    openInEditor();
    runCLI('init --no-interactive');
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should initialize @nx/maven', () => {
    const projects = runCLI(`show projects`);
    expect(projects).toContain('app');
    expect(projects).toContain('lib');
    expect(projects).toContain('utils');
    expect(projects).toContain(mavenProjectName);
  });
});

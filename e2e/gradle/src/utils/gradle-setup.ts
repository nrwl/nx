import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e-utils';
import { createGradleProject } from './create-gradle-project';

export function setupGradleProject(type: 'kotlin' | 'groovy') {
  const gradleProjectName = uniq('my-gradle-project');
  newProject();
  createGradleProject(gradleProjectName, type);
  runCLI(`add @nx/gradle`);
  return gradleProjectName;
}

export function teardownGradleProject() {
  cleanupProject();
}

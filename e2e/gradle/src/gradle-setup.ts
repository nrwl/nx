import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e-utils';
import { createGradleProject } from './utils/create-gradle-project';

export interface GradleTestSetup {
  gradleProjectName: string;
  type: 'kotlin' | 'groovy';
}

export function setupGradleTest(type: 'kotlin' | 'groovy'): GradleTestSetup {
  const gradleProjectName = uniq('my-gradle-project');
  newProject();
  createGradleProject(gradleProjectName, type);
  runCLI(`add @nx/gradle`);

  return {
    gradleProjectName,
    type,
  };
}

export function cleanupGradleTest(): void {
  cleanupProject();
}

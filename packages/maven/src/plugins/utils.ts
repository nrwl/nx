import { join } from 'path';
import { existsSync } from 'fs';
import { workspaceRoot } from '@nx/devkit';

/**
 * Detect Maven wrapper in workspace root, fallback to 'mvn'
 */
export function detectMavenWrapper(): string {
  const isWindows = process.platform === 'win32';
  const wrapperFile = isWindows ? 'mvnw.cmd' : 'mvnw';
  const wrapperPath = join(workspaceRoot, wrapperFile);

  if (existsSync(wrapperPath)) {
    return wrapperPath;
  }

  return 'mvn';
}

/**
 * Get the best available phase for a dependency project
 */
export function getBestDependencyPhase(
  mavenData: any,
  depProjectName: string, 
  requestedPhase: string
): string {
  // Maven lifecycle phases in order
  const mavenPhases = [
    'validate', 'initialize', 'generate-sources', 'process-sources', 
    'generate-resources', 'process-resources', 'compile', 'process-classes',
    'generate-test-sources', 'process-test-sources', 'generate-test-resources',
    'process-test-resources', 'test-compile', 'process-test-classes', 'test',
    'prepare-package', 'package', 'pre-integration-test', 'integration-test',
    'post-integration-test', 'verify', 'install', 'deploy'
  ];
  
  // Find the dependency project's available phases
  const depProject = mavenData.projects.find((p: any) => `${p.groupId}.${p.artifactId}` === depProjectName);
  if (!depProject || !depProject.lifecycle || !depProject.lifecycle.phases) {
    return requestedPhase; // Fallback to requested phase if we can't find the project
  }
  
  const availablePhases = depProject.lifecycle.phases;
  const requestedPhaseIndex = mavenPhases.indexOf(requestedPhase);
  
  // If the requested phase is available, use it
  if (availablePhases.includes(requestedPhase)) {
    return requestedPhase;
  }
  
  // Otherwise, find the highest available phase that comes before the requested phase
  for (let i = requestedPhaseIndex - 1; i >= 0; i--) {
    if (availablePhases.includes(mavenPhases[i])) {
      return mavenPhases[i];
    }
  }
  
  // If no earlier phase is available, use the earliest available phase
  return availablePhases[0] || requestedPhase;
}
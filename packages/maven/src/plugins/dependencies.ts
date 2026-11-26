import { CreateDependencies, logger } from '@nx/devkit';
import { getCurrentMavenData } from './maven-data-cache';
import { createProjectRootMappingsFromProjectConfigurations } from '@nx/devkit/internal';

/**
 * Create dependencies between Maven projects by analyzing the createNodesResults
 * Uses in-memory Maven analysis data that was stored by createNodes
 */
export const createDependencies: CreateDependencies = async (
  options,
  context
) => {
  const mavenData = getCurrentMavenData();

  if (!mavenData) {
    logger.verbose(
      '[Maven Dependencies] No Maven data found in workspace:',
      context.workspaceRoot
    );
    return [];
  }

  logger.verbose(
    '[Maven Dependencies] Found Maven data with',
    mavenData.createDependenciesResults.length,
    'dependencies'
  );

  // Create a mapping from project root to project name
  const rootToProjectMap = createProjectRootMappingsFromProjectConfigurations(
    context.projects
  );

  // External deps use maven: prefix — pass through as-is
  const resolveProject = (ref: string): string => {
    if (ref.startsWith('maven:')) {
      return ref;
    }
    const projectName = rootToProjectMap.get(ref);
    if (!projectName) {
      throw new Error(`No Nx project found at Maven project root "${ref}"`);
    }
    return projectName;
  };

  // Extract and transform dependencies from the mavenData
  const transformedDependencies = mavenData.createDependenciesResults.map(
    (dep) => ({
      ...dep,
      source: resolveProject(dep.source),
      target: resolveProject(dep.target),
    })
  );

  return transformedDependencies;
};

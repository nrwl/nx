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

  // Extract and transform dependencies from the mavenData
  // Filter out deps where source or target can't be resolved to a workspace
  // project (e.g., external-to-external Maven edges like
  // maven:org.foo:bar -> maven:org.baz:qux)
  const transformedDependencies = [];
  for (const dep of mavenData.createDependenciesResults) {
    const source = rootToProjectMap.get(dep.source);
    const target = dep.target.startsWith('maven:')
      ? dep.target
      : rootToProjectMap.get(dep.target);
    if (source && target) {
      transformedDependencies.push({ ...dep, source, target });
    }
  }

  return transformedDependencies;
};

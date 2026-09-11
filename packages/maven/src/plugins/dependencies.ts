import { CreateDependencies, logger, normalizePath } from '@nx/devkit';
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

  // A cache written by an older plugin is keyed on project hashes alone, so it
  // survives an upgrade and can still hold OS-separated paths. Normalize on
  // read as well, or the graph keeps failing until the user runs `nx reset`.
  const transformedDependencies = mavenData.createDependenciesResults.map(
    (dep) => ({
      ...dep,
      sourceFile: normalizePath(dep.sourceFile),
      source: dep.source.startsWith('maven:')
        ? dep.source
        : rootToProjectMap.get(normalizePath(dep.source)),
      // External deps use maven: prefix — pass through as-is
      target: dep.target.startsWith('maven:')
        ? dep.target
        : rootToProjectMap.get(normalizePath(dep.target)),
    })
  );

  return transformedDependencies;
};

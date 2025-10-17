import {
  CreateDependencies,
  DependencyType,
  ProjectConfiguration,
  RawProjectGraphDependency,
} from '@nx/devkit';

import { DotNetPluginOptions } from './create-nodes';
import {
  readCachedAnalysisResult,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client';

function createProjectRootMappings(
  projects: Record<string, ProjectConfiguration>
): Record<string, string> {
  const rootMap: Record<string, string> = {};
  for (const [, project] of Object.entries(projects)) {
    if (project.root && project.name) {
      rootMap[project.root] = project.name;
    }
  }
  return rootMap;
}

export const createDependencies: CreateDependencies<
  DotNetPluginOptions
> = async (_, ctx) => {
  const dependencies: RawProjectGraphDependency[] = [];
  const rootMap = createProjectRootMappings(ctx.projects);

  // Read the cached analysis result populated by createNodes
  // createNodes always runs before createDependencies, so the cache should be populated
  const cachedResult = readCachedAnalysisResult();

  if (isAnalysisErrorResult(cachedResult)) {
    throw new Error(
      'There was an error analyzing .NET projects. See earlier logs.'
    );
  }

  const { referencesByRoot } = cachedResult;

  // Map references to dependencies
  // The analyzer returns: { [projectRoot]: [referencedProjectRoot1, referencedProjectRoot2, ...] }
  // We need to convert this to Nx dependencies
  for (const [sourceRoot, referencedRoots] of Object.entries(
    referencesByRoot
  )) {
    const sourceName = rootMap[sourceRoot];
    if (!sourceName) {
      continue;
    }

    for (const targetRoot of referencedRoots.refs) {
      const targetName = rootMap[targetRoot];
      if (targetName) {
        dependencies.push({
          source: sourceName,
          target: targetName,
          type: DependencyType.static,
          sourceFile: referencedRoots.sourceConfigFile,
        });
      }
    }
  }

  return dependencies;
};

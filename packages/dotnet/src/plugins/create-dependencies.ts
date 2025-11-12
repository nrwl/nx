import {
  CreateDependencies,
  DependencyType,
  RawProjectGraphDependency,
} from '@nx/devkit';

import { DotNetPluginOptions } from './create-nodes.js';
import {
  readCachedAnalysisResult,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client.js';
import { createProjectRootMappingsFromProjectConfigurations } from '@nx/devkit/internal';

export const createDependencies: CreateDependencies<
  DotNetPluginOptions
> = async (_, ctx) => {
  const dependencies: RawProjectGraphDependency[] = [];
  const rootMap = createProjectRootMappingsFromProjectConfigurations(
    ctx.projects
  );

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
    const sourceName = rootMap.get(sourceRoot);
    if (!sourceName) {
      continue;
    }

    for (const targetRoot of referencedRoots.refs) {
      const targetName = rootMap.get(targetRoot);
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

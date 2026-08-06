import {
  CreateDependencies,
  DependencyType,
  RawProjectGraphDependency,
} from '@nx/devkit';

import { DotNetPluginOptions, nugetExternalNodeName } from './create-nodes';
import {
  readCachedAnalysisResult,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client';
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

  const { nodesByFile, referencesByRoot, packagesByRoot } = cachedResult;

  // Dependencies from a workspace project require a sourceFile; a project with only package
  // references has no referencesByRoot entry, so recover its csproj from nodesByFile.
  const configFileByRoot = new Map<string, string>();
  for (const [configFile, node] of Object.entries(nodesByFile)) {
    if (node?.root !== undefined) {
      configFileByRoot.set(node.root, configFile);
    }
  }

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

  // Edges from each project to the NuGet packages it references.
  for (const [sourceRoot, packages] of Object.entries(packagesByRoot ?? {})) {
    const sourceName = rootMap.get(sourceRoot);
    if (!sourceName) {
      continue;
    }

    const sourceConfigFile = configFileByRoot.get(sourceRoot);
    if (!sourceConfigFile) {
      continue;
    }

    for (const pkg of packages) {
      dependencies.push({
        source: sourceName,
        target: nugetExternalNodeName(pkg),
        type: DependencyType.static,
        sourceFile: sourceConfigFile,
      });
    }
  }

  return dependencies;
};

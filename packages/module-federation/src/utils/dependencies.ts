import type { ProjectGraph } from '@nx/devkit';
import type { WorkspaceLibrary } from './models';
import { readTsPathMappings } from './typescript';
import {
  getOutputsForTargetAndConfiguration,
  parseTargetString,
} from '@nx/devkit';

export function getDependentPackagesForProject(
  projectGraph: ProjectGraph,
  name: string
): {
  workspaceLibraries: WorkspaceLibrary[];
  npmPackages: string[];
} {
  const { npmPackages, workspaceLibraries } = collectDependencies(
    projectGraph,
    name
  );

  return {
    workspaceLibraries: [...workspaceLibraries.values()],
    npmPackages: [...npmPackages],
  };
}

function collectDependencies(
  projectGraph: ProjectGraph,
  name: string,
  dependencies = {
    workspaceLibraries: new Map<string, WorkspaceLibrary>(),
    npmPackages: new Set<string>(),
  },
  seen: Set<string> = new Set()
): {
  workspaceLibraries: Map<string, WorkspaceLibrary>;
  npmPackages: Set<string>;
} {
  if (seen.has(name)) {
    return dependencies;
  }
  seen.add(name);

  (projectGraph.dependencies[name] ?? []).forEach((dependency) => {
    if (dependency.target.startsWith('npm:')) {
      dependencies.npmPackages.add(dependency.target.replace('npm:', ''));
    } else {
      dependencies.workspaceLibraries.set(dependency.target, {
        name: dependency.target,
        root: projectGraph.nodes[dependency.target].data.root,
        importKey: getLibraryImportPath(dependency.target, projectGraph),
      });
      collectDependencies(projectGraph, dependency.target, dependencies, seen);
    }
  });

  return dependencies;
}

function getLibraryImportPath(
  library: string,
  projectGraph: ProjectGraph
): string | undefined {
  let buildLibsFromSource = true;
  if (process.env.NX_BUILD_LIBS_FROM_SOURCE) {
    buildLibsFromSource = process.env.NX_BUILD_LIBS_FROM_SOURCE === 'true';
  }
  const libraryNode = projectGraph.nodes[library];
  let sourceRoots = [libraryNode.data.sourceRoot];

  if (!buildLibsFromSource && process.env.NX_BUILD_TARGET) {
    const buildTarget = parseTargetString(
      process.env.NX_BUILD_TARGET,
      projectGraph
    );
    sourceRoots = getOutputsForTargetAndConfiguration(
      buildTarget,
      {},
      libraryNode
    );
  }

  const tsConfigPathMappings = readTsPathMappings();

  for (const [key, value] of Object.entries(tsConfigPathMappings)) {
    for (const src of sourceRoots) {
      if (value.find((path) => path.startsWith(src))) {
        return key;
      }
    }
  }

  return undefined;
}

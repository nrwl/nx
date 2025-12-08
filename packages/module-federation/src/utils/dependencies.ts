import type { ProjectGraph } from '@nx/devkit';
import {
  getOutputsForTargetAndConfiguration,
  parseTargetString,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { ParsedCommandLine } from 'typescript';
import type { WorkspaceLibrary } from './models';
import { readTsPathMappings } from './typescript';

// Cache for getDependentPackagesForProject results
// Uses WeakMap keyed by projectGraph so cache is automatically invalidated when graph changes
const dependentPackagesCache = new WeakMap<
  ProjectGraph,
  Map<
    string,
    {
      workspaceLibraries: WorkspaceLibrary[];
      npmPackages: string[];
    }
  >
>();

export function getDependentPackagesForProject(
  projectGraph: ProjectGraph,
  name: string
): {
  workspaceLibraries: WorkspaceLibrary[];
  npmPackages: string[];
} {
  // Check cache first
  let graphCache = dependentPackagesCache.get(projectGraph);
  if (graphCache) {
    const cached = graphCache.get(name);
    if (cached) {
      return cached;
    }
  } else {
    graphCache = new Map();
    dependentPackagesCache.set(projectGraph, graphCache);
  }

  // Hoist tsConfigPathMappings read to avoid repeated calls in getLibraryImportPath
  const tsConfigPathMappings = readTsPathMappings();

  const { npmPackages, workspaceLibraries } = collectDependencies(
    projectGraph,
    name,
    undefined,
    undefined,
    tsConfigPathMappings
  );

  const result = {
    workspaceLibraries: [...workspaceLibraries.values()],
    npmPackages: [...npmPackages],
  };

  // Cache the result
  graphCache.set(name, result);

  return result;
}

function collectDependencies(
  projectGraph: ProjectGraph,
  name: string,
  dependencies = {
    workspaceLibraries: new Map<string, WorkspaceLibrary>(),
    npmPackages: new Set<string>(),
  },
  seen: Set<string> = new Set(),
  tsConfigPathMappings: ParsedCommandLine['options']['paths'] = {}
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
      if (projectGraph.nodes[dependency.target]) {
        dependencies.workspaceLibraries.set(dependency.target, {
          name: dependency.target,
          root: projectGraph.nodes[dependency.target].data.root,
          importKey: getLibraryImportPath(
            dependency.target,
            projectGraph,
            tsConfigPathMappings
          ),
        });
        collectDependencies(
          projectGraph,
          dependency.target,
          dependencies,
          seen,
          tsConfigPathMappings
        );
      }
    }
  });

  return dependencies;
}

function getLibraryImportPath(
  library: string,
  projectGraph: ProjectGraph,
  tsConfigPathMappings: ParsedCommandLine['options']['paths'] = {}
): string | undefined {
  let buildLibsFromSource = true;
  if (process.env.NX_BUILD_LIBS_FROM_SOURCE) {
    buildLibsFromSource = process.env.NX_BUILD_LIBS_FROM_SOURCE === 'true';
  }
  const libraryNode = projectGraph.nodes[library];
  let sourceRoots = [getProjectSourceRoot(libraryNode.data)];

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

  for (const [key, value] of Object.entries(tsConfigPathMappings)) {
    for (const src of sourceRoots) {
      if (value.find((path) => path.startsWith(src))) {
        return key;
      }
    }
  }

  // Return library name if not found in TS path mappings
  // This supports TS Solution + PM Workspaces where libs use package.json instead
  return library;
}

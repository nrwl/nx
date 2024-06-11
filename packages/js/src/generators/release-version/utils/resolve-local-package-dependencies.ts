import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  Tree,
  joinPathFragments,
  readJson,
  workspaceRoot,
} from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';
import { satisfies } from 'semver';
import { Package } from './package';
import { resolveVersionSpec } from './resolve-version-spec';

export interface LocalPackageDependency extends ProjectGraphDependency {
  /**
   * The rawVersionSpec contains the value of the version spec as it was defined in the package.json
   * of the dependent project. This can be useful in cases where the version spec is a range, path or
   * workspace reference, and it needs to be be reverted to that original value as part of the release.
   */
  rawVersionSpec: string;
  dependencyCollection:
    | 'dependencies'
    | 'devDependencies'
    | 'optionalDependencies';
  // we don't currently manage peer dependencies
}

export function resolveLocalPackageDependencies(
  tree: Tree,
  projectGraph: ProjectGraph,
  filteredProjects: ProjectGraphProjectNode[],
  projectNameToPackageRootMap: Map<string, string>,
  resolvePackageRoot: (projectNode: ProjectGraphProjectNode) => string,
  includeAll = false
): Record<string, LocalPackageDependency[]> {
  const localPackageDependencies: Record<string, LocalPackageDependency[]> = {};
  const projectNodeToPackageMap = new Map<ProjectGraphProjectNode, Package>();

  const projects = includeAll
    ? Object.values(projectGraph.nodes)
    : filteredProjects;

  // Iterate through the projects being released and resolve any relevant package.json data
  for (const projectNode of projects) {
    // Resolve the package.json path for the project, taking into account any custom packageRoot settings
    let packageRoot = projectNameToPackageRootMap.get(projectNode.name);
    // packageRoot wasn't added to the map yet, try to resolve it dynamically
    if (!packageRoot && includeAll) {
      packageRoot = resolvePackageRoot(projectNode);
      if (!packageRoot) {
        continue;
      }
      // Append it to the map for later use within the release version generator
      projectNameToPackageRootMap.set(projectNode.name, packageRoot);
    }
    const packageJsonPath = joinPathFragments(packageRoot, 'package.json');
    if (!tree.exists(packageJsonPath)) {
      continue;
    }
    const packageJson = readJson(tree, packageJsonPath) as PackageJson;
    const pkg = new Package(packageJson, workspaceRoot, packageRoot);
    projectNodeToPackageMap.set(projectNode, pkg);
  }

  // populate local npm package dependencies
  for (const projectDeps of Object.values(projectGraph.dependencies)) {
    const workspaceDeps = projectDeps.filter(
      (dep) =>
        !isExternalNpmDependency(dep.target) &&
        !isExternalNpmDependency(dep.source)
    );
    for (const dep of workspaceDeps) {
      const source = projectGraph.nodes[dep.source];
      const target = projectGraph.nodes[dep.target];
      if (
        !source ||
        !projectNodeToPackageMap.has(source) ||
        !target ||
        !projectNodeToPackageMap.has(target)
      ) {
        // only relevant for dependencies between two workspace projects with Package objects
        continue;
      }

      const sourcePackage = projectNodeToPackageMap.get(source);
      const targetPackage = projectNodeToPackageMap.get(target);
      const sourceNpmDependency = sourcePackage.getLocalDependency(
        targetPackage.name
      );
      if (!sourceNpmDependency) {
        continue;
      }

      const targetVersionSpec = resolveVersionSpec(
        targetPackage.name,
        targetPackage.version,
        sourceNpmDependency.spec,
        sourcePackage.location
      );
      const targetMatchesRequirement =
        // For file: and workspace: protocols the targetVersionSpec could be a path, so we check if it matches the target's location
        targetVersionSpec === targetPackage.location ||
        satisfies(targetPackage.version, targetVersionSpec);

      if (targetMatchesRequirement) {
        // track only local package dependencies that are satisfied by the target's version
        localPackageDependencies[dep.source] = [
          ...(localPackageDependencies[dep.source] || []),
          {
            ...dep,
            dependencyCollection: sourceNpmDependency.collection,
            rawVersionSpec: sourceNpmDependency.spec,
          },
        ];
      }
    }
  }

  return localPackageDependencies;
}

function isExternalNpmDependency(dep: string): boolean {
  return dep.startsWith('npm:');
}

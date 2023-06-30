import { readJsonFile } from '../../../utils/fileutils';
import { sortObjectByKeys } from '../../../utils/object-sort';
import {
  fileDataDepTarget,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { PackageJson } from '../../../utils/package-json';
import { existsSync } from 'fs';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  filterUsingGlobPatterns,
  getTargetInputs,
} from '../../../hasher/task-hasher';
import { readNxJson } from '../../../config/configuration';
import { readProjectFileMapCache } from '../../../project-graph/nx-deps-cache';
import { join } from 'path';

interface NpmDeps {
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly peerDependenciesMeta: Record<string, { optional: boolean }>;
}

/**
 * Creates a package.json in the output directory for support to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 * If isProduction flag is set, it wil  remove devDependencies and optional peerDependencies
 */
export function createPackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: {
    target?: string;
    root?: string;
    isProduction?: boolean;
    helperDependencies?: string[];
  } = {},
  fileMap: ProjectFileMap = null
): PackageJson {
  const projectNode = graph.nodes[projectName];
  const isLibrary = projectNode.type === 'lib';

  const npmDeps = findProjectsNpmDependencies(
    projectNode,
    graph,
    options.target,
    { helperDependencies: options.helperDependencies },
    fileMap
  );

  // default package.json if one does not exist
  let packageJson: PackageJson = {
    name: projectName,
    version: '0.0.1',
  };
  const projectPackageJsonPath = join(
    options.root || workspaceRoot,
    projectNode.data.root,
    'package.json'
  );
  if (existsSync(projectPackageJsonPath)) {
    try {
      packageJson = readJsonFile(projectPackageJsonPath);
      // for standalone projects we don't want to include all the root dependencies
      if (graph.nodes[projectName].data.root === '.') {
        // TODO: We should probably think more on this - Nx can't always
        // detect all external dependencies, and there's not a way currently
        // to tell Nx that we need one of these deps. For non-standalone projects
        // we tell people to add it to the package.json of the project, and we
        // merge it. For standalone, this pattern doesn't work because of this piece of code.
        // It breaks expectations, but also, I don't know another way around it currently.
        // If Nx doesn't pick up a dep, say some css lib that is only imported in a .scss file,
        // we need to be able to tell it to keep that dep in the generated package.json.
        delete packageJson.dependencies;
        delete packageJson.devDependencies;
      }
    } catch (e) {}
  }

  const getVersion = (
    packageName: string,
    version: string,
    section: 'devDependencies' | 'dependencies'
  ) => {
    return (
      packageJson[section][packageName] ||
      (isLibrary && rootPackageJson[section]?.[packageName]) ||
      version
    );
  };

  const rootPackageJson = readJsonFile(
    `${options.root || workspaceRoot}/package.json`
  );
  Object.entries(npmDeps.dependencies).forEach(([packageName, version]) => {
    if (
      rootPackageJson.devDependencies?.[packageName] &&
      !packageJson.dependencies?.[packageName] &&
      !packageJson.peerDependencies?.[packageName]
    ) {
      // don't store dev dependencies for production
      if (!options.isProduction) {
        packageJson.devDependencies ??= {};
        packageJson.devDependencies[packageName] = getVersion(
          packageName,
          version,
          'devDependencies'
        );
      }
    } else {
      if (!packageJson.peerDependencies?.[packageName]) {
        packageJson.dependencies ??= {};
        packageJson.dependencies[packageName] = getVersion(
          packageName,
          version,
          'dependencies'
        );
      }
    }
  });
  if (!isLibrary) {
    Object.entries(npmDeps.peerDependencies).forEach(
      ([packageName, version]) => {
        if (!packageJson.peerDependencies?.[packageName]) {
          if (rootPackageJson.dependencies?.[packageName]) {
            packageJson.dependencies ??= {};
            packageJson.dependencies[packageName] = getVersion(
              packageName,
              version,
              'dependencies'
            );
            return;
          }

          const isOptionalPeer =
            npmDeps.peerDependenciesMeta[packageName]?.optional;
          if (!isOptionalPeer) {
            if (
              !options.isProduction ||
              rootPackageJson.dependencies?.[packageName]
            ) {
              packageJson.peerDependencies ??= {};
              packageJson.peerDependencies[packageName] = getVersion(
                packageName,
                version,
                'dependencies'
              );
            }
          } else if (!options.isProduction) {
            // add peer optional dependencies if not in production
            packageJson.peerDependencies ??= {};
            packageJson.peerDependencies[packageName] = version;
            packageJson.peerDependenciesMeta ??= {};
            packageJson.peerDependenciesMeta[packageName] = {
              optional: true,
            };
          }
        }
      }
    );
  }

  packageJson.devDependencies &&= sortObjectByKeys(packageJson.devDependencies);
  packageJson.dependencies &&= sortObjectByKeys(packageJson.dependencies);
  packageJson.peerDependencies &&= sortObjectByKeys(
    packageJson.peerDependencies
  );
  packageJson.peerDependenciesMeta &&= sortObjectByKeys(
    packageJson.peerDependenciesMeta
  );

  return packageJson;
}

export function findProjectsNpmDependencies(
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  target: string,
  options: {
    helperDependencies?: string[];
    ignoredDependencies?: string[];
  },
  fileMap?: ProjectFileMap
): NpmDeps {
  if (fileMap == null) {
    fileMap = readProjectFileMapCache()?.projectFileMap || {};
  }

  const { selfInputs, dependencyInputs } = target
    ? getTargetInputs(readNxJson(), projectNode, target)
    : { selfInputs: [], dependencyInputs: [] };

  const npmDeps: NpmDeps = {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  };

  const seen = new Set<string>();

  options.helperDependencies?.forEach((dep) => {
    seen.add(dep);
    npmDeps.dependencies[graph.externalNodes[dep].data.packageName] =
      graph.externalNodes[dep].data.version;
    recursivelyCollectPeerDependencies(dep, graph, npmDeps, seen);
  });

  findAllNpmDeps(
    fileMap,
    projectNode,
    graph,
    npmDeps,
    seen,
    options.ignoredDependencies || [],
    dependencyInputs,
    selfInputs
  );

  return npmDeps;
}

function findAllNpmDeps(
  projectFileMap: ProjectFileMap,
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>,
  ignoredDependencies: string[],
  dependencyPatterns: string[],
  rootPatterns?: string[]
): void {
  if (seen.has(projectNode.name)) return;

  seen.add(projectNode.name);

  const projectFiles = filterUsingGlobPatterns(
    projectNode.data.root,
    projectFileMap[projectNode.name] || [],
    rootPatterns ?? dependencyPatterns
  );

  const projectDependencies = new Set<string>();

  projectFiles.forEach((fileData) =>
    fileData.deps?.forEach((dep) =>
      projectDependencies.add(fileDataDepTarget(dep))
    )
  );

  for (const dep of projectDependencies) {
    const node = graph.externalNodes[dep];

    if (seen.has(dep)) {
      // if it's in peerDependencies, move it to regular dependencies
      // since this is a direct dependency of the project
      if (node && npmDeps.peerDependencies[node.data.packageName]) {
        npmDeps.dependencies[node.data.packageName] = node.data.version;
        delete npmDeps.peerDependencies[node.data.packageName];
      }
    } else {
      if (node) {
        seen.add(dep);
        // do not add ignored dependencies to the list or non-npm dependencies
        if (
          ignoredDependencies.includes(node.data.packageName) ||
          node.type !== 'npm'
        ) {
          continue;
        }

        npmDeps.dependencies[node.data.packageName] = node.data.version;
        recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
      } else if (graph.nodes[dep]) {
        findAllNpmDeps(
          projectFileMap,
          graph.nodes[dep],
          graph,
          npmDeps,
          seen,
          ignoredDependencies,
          dependencyPatterns
        );
      }
    }
  }
}

function recursivelyCollectPeerDependencies(
  projectName: string,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>
) {
  const npmPackage = graph.externalNodes[projectName];
  if (!npmPackage) {
    return npmDeps;
  }

  const packageName = npmPackage.data.packageName;
  try {
    const packageJson = require(`${packageName}/package.json`);
    if (!packageJson.peerDependencies) {
      return npmDeps;
    }

    Object.keys(packageJson.peerDependencies)
      .map((dependencyName) => `npm:${dependencyName}`)
      .map((dependency) => graph.externalNodes[dependency])
      .filter(Boolean)
      .forEach((node) => {
        if (!seen.has(node.name)) {
          seen.add(node.name);
          npmDeps.peerDependencies[node.data.packageName] = node.data.version;
          if (
            packageJson.peerDependenciesMeta &&
            packageJson.peerDependenciesMeta[node.data.packageName] &&
            packageJson.peerDependenciesMeta[node.data.packageName].optional
          ) {
            npmDeps.peerDependenciesMeta[node.data.packageName] = {
              optional: true,
            };
          }
          recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
        }
      });
    return npmDeps;
  } catch (e) {
    return npmDeps;
  }
}

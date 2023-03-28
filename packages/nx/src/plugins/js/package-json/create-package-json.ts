import { readJsonFile } from '../../../utils/fileutils';
import { sortObjectByKeys } from '../../../utils/object-sort';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { PackageJson } from '../../../utils/package-json';
import { existsSync } from 'fs';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  filterUsingGlobPatterns,
  getTargetInputs,
} from '../../../hasher/hasher';
import { readNxJson } from '../../../config/configuration';

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
  } = {}
): PackageJson {
  const projectNode = graph.nodes[projectName];

  const { selfInputs, dependencyInputs } = options.target
    ? getTargetInputs(readNxJson(), projectNode, options.target)
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
    projectNode,
    graph,
    npmDeps,
    seen,
    dependencyInputs,
    selfInputs
  );

  // default package.json if one does not exist
  let packageJson: PackageJson = {
    name: projectName,
    version: '0.0.1',
  };
  if (existsSync(`${graph.nodes[projectName].data.root}/package.json`)) {
    try {
      packageJson = readJsonFile(
        `${graph.nodes[projectName].data.root}/package.json`
      );
      // for standalone projects we don't want to include all the root dependencies
      if (graph.nodes[projectName].data.root === '.') {
        packageJson = {
          name: packageJson.name,
          version: packageJson.version,
        };
      }
    } catch (e) {}
  }

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
        packageJson.devDependencies[packageName] = version;
      }
    } else {
      if (!packageJson.peerDependencies?.[packageName]) {
        packageJson.dependencies ??= {};
        packageJson.dependencies[packageName] = version;
      }
    }
  });
  Object.entries(npmDeps.peerDependencies).forEach(([packageName, version]) => {
    if (!packageJson.peerDependencies?.[packageName]) {
      if (rootPackageJson.dependencies?.[packageName]) {
        packageJson.dependencies ??= {};
        packageJson.dependencies[packageName] = version;
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
          packageJson.peerDependencies[packageName] = version;
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
  });

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

function findAllNpmDeps(
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>,
  dependencyPatterns: string[],
  rootPatterns?: string[]
): void {
  if (seen.has(projectNode.name)) return;

  seen.add(projectNode.name);

  const projectFiles = filterUsingGlobPatterns(
    projectNode.data.root,
    projectNode.data.files,
    rootPatterns ?? dependencyPatterns
  );

  const projectDependencies = new Set<string>();

  projectFiles.forEach((fileData) =>
    fileData.dependencies?.forEach((dep) => projectDependencies.add(dep.target))
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
        npmDeps.dependencies[node.data.packageName] = node.data.version;
        recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
      } else {
        findAllNpmDeps(
          graph.nodes[dep],
          graph,
          npmDeps,
          seen,
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

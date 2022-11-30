import { readJsonFile } from './fileutils';
import { sortObjectByKeys } from './object-sort';
import { ProjectGraph } from '../config/project-graph';
import { PackageJson } from './package-json';
import { existsSync } from 'fs';
import { workspaceRoot } from './workspace-root';

/**
 * Creates a package.json in the output directory for support to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 */
export function createPackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: {
    root?: string;
  }
): PackageJson {
  const npmDeps = findAllNpmDeps(projectName, graph);
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
      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies[packageName] = version;
    } else {
      if (!packageJson.peerDependencies?.[packageName]) {
        packageJson.dependencies = packageJson.dependencies || {};
        packageJson.dependencies[packageName] = version;
      }
    }
  });
  Object.entries(npmDeps.peerDependencies).forEach(([packageName, version]) => {
    if (!packageJson.peerDependencies?.[packageName]) {
      packageJson.dependencies[packageName] = version;
    }
  });

  packageJson.devDependencies &&= sortObjectByKeys(packageJson.devDependencies);
  packageJson.dependencies &&= sortObjectByKeys(packageJson.dependencies);
  packageJson.peerDependencies &&= sortObjectByKeys(
    packageJson.peerDependencies
  );

  return packageJson;
}

function findAllNpmDeps(
  projectName: string,
  graph: ProjectGraph,
  list: {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  } = { dependencies: {}, peerDependencies: {} },
  seen = new Set<string>()
) {
  const node = graph.externalNodes[projectName];

  if (seen.has(projectName)) {
    // if it's in peerDependencies, move it to regular dependencies
    // since this is a direct dependency of the project
    if (node && list.peerDependencies[node.data.packageName]) {
      list.dependencies[node.data.packageName] = node.data.version;
      delete list.peerDependencies[node.data.packageName];
    }
    return list;
  }

  seen.add(projectName);

  if (node) {
    list.dependencies[node.data.packageName] = node.data.version;
    recursivelyCollectPeerDependencies(node.name, graph, list, seen);
  } else {
    // we are not interested in the dependencies of external projects
    graph.dependencies[projectName]?.forEach((dep) => {
      if (dep.type === 'static' || dep.type === 'dynamic') {
        findAllNpmDeps(dep.target, graph, list, seen);
      }
    });
  }

  return list;
}

function recursivelyCollectPeerDependencies(
  projectName: string,
  graph: ProjectGraph,
  list: {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  },
  seen = new Set<string>()
) {
  const npmPackage = graph.externalNodes[projectName];
  if (!npmPackage) {
    return list;
  }

  const packageName = npmPackage.data.packageName;
  try {
    const packageJson = require(`${packageName}/package.json`);
    if (!packageJson.peerDependencies) {
      return list;
    }

    Object.keys(packageJson.peerDependencies)
      .map((dependencyName) => `npm:${dependencyName}`)
      .map((dependency) => graph.externalNodes[dependency])
      .filter(Boolean)
      .forEach((node) => {
        if (
          !packageJson.peerDependenciesMeta?.[node.data.packageName]
            ?.optional &&
          !seen.has(node.name)
        ) {
          seen.add(node.name);
          list.peerDependencies[node.data.packageName] = node.data.version;
          recursivelyCollectPeerDependencies(node.name, graph, list, seen);
        }
      });
    return list;
  } catch (e) {
    return list;
  }
}

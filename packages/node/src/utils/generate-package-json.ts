import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  readJsonFile,
  writeJsonFile,
} from '@nrwl/workspace/src/utilities/fileutils';

import { BuildNodeBuilderOptions } from './types';
import { OUT_FILENAME } from './config';

/**
 * Creates a package.json in the output directory for support  to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 *
 * @param projectName
 * @param graph
 * @param options
 * @constructor
 */
export function generatePackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: BuildNodeBuilderOptions
) {
  const npmDeps = findAllNpmDeps(projectName, graph);
  // default package.json if one does not exist
  let packageJson = {
    name: projectName,
    version: '0.0.1',
    main: OUT_FILENAME,
    dependencies: {},
  };

  try {
    packageJson = readJsonFile(`${options.projectRoot}/package.json`);
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
  } catch (e) {}

  const rootPackageJson = readJsonFile(`${options.root}/package.json`);

  Object.entries(npmDeps).forEach(([packageName, version]) => {
    // don't include devDeps
    if (rootPackageJson.devDependencies?.[packageName]) {
      return;
    }

    packageJson.dependencies[packageName] = version;
  });

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}

function findAllNpmDeps(
  projectName: string,
  graph: ProjectGraph,
  list: { [packageName: string]: string } = {},
  seen = new Set<string>()
) {
  if (seen.has(projectName)) {
    return list;
  }

  seen.add(projectName);

  const node = graph.nodes[projectName];

  if (node.type === 'npm') {
    list[node.data.packageName] = node.data.version;
  }
  graph.dependencies[projectName]?.forEach((dep) => {
    findAllNpmDeps(dep.target, graph, list, seen);
  });

  return list;
}

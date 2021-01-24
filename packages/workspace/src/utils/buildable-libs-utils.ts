import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectType,
} from '../core/project-graph';
import { BuilderContext } from '@angular-devkit/architect';
import { join, resolve, dirname, relative } from 'path';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/workspace/src/utilities/fileutils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { getOutputsForTargetAndConfiguration } from '@nrwl/workspace/src/tasks-runner/utils';
import * as ts from 'typescript';
import { unlinkSync } from 'fs';

function isBuildable(target: string, node: ProjectGraphNode): boolean {
  return (
    node.data.targets &&
    node.data.targets[target] &&
    node.data.targets[target].executor !== ''
  );
}

export type DependentBuildableProjectNode = {
  name: string;
  outputs: string[];
  node: ProjectGraphNode;
};

export function calculateProjectDependencies(
  projGraph: ProjectGraph,
  context: BuilderContext
): { target: ProjectGraphNode; dependencies: DependentBuildableProjectNode[] } {
  const target = projGraph.nodes[context.target.project];
  // gather the library dependencies
  const dependencies = recursivelyCollectDependencies(
    context.target.project,
    projGraph,
    []
  )
    .map((dep) => {
      const depNode = projGraph.nodes[dep];
      if (
        depNode.type === ProjectType.lib &&
        isBuildable(context.target.target, depNode)
      ) {
        const libPackageJson = readJsonFile(
          join(context.workspaceRoot, depNode.data.root, 'package.json')
        );

        return {
          name: libPackageJson.name, // i.e. @workspace/mylib
          outputs: getOutputsForTargetAndConfiguration(
            {
              overrides: {},
              target: context.target,
            },
            depNode
          ),
          node: depNode,
        };
      } else if (depNode.type === 'npm') {
        return {
          name: depNode.data.packageName,
          outputs: [],
          node: depNode,
        };
      } else {
        return null;
      }
    })
    .filter((x) => !!x);
  return { target, dependencies };
}

function recursivelyCollectDependencies(
  project: string,
  projGraph: ProjectGraph,
  acc: string[]
) {
  (projGraph.dependencies[project] || []).forEach((dependency) => {
    if (acc.indexOf(dependency.target) === -1) {
      acc.push(dependency.target);
      recursivelyCollectDependencies(dependency.target, projGraph, acc);
    }
  });
  return acc;
}

function readTsConfigWithRemappedPaths(
  tsConfig: string,
  generatedTsConfigPath: string,
  dependencies: DependentBuildableProjectNode[]
) {
  const generatedTsConfig: any = { compilerOptions: {} };
  generatedTsConfig.extends = relative(
    dirname(generatedTsConfigPath),
    tsConfig
  );
  generatedTsConfig.compilerOptions.paths = computeCompilerOptionsPaths(
    tsConfig,
    dependencies
  );
  return generatedTsConfig;
}

export function computeCompilerOptionsPaths(tsConfig, dependencies) {
  const paths = readPaths(tsConfig) || {};
  updatePaths(dependencies, paths);
  return paths;
}

function readPaths(tsConfig: string) {
  try {
    const parsedTSConfig = ts.readConfigFile(tsConfig, ts.sys.readFile).config;
    if (
      parsedTSConfig.compilerOptions &&
      parsedTSConfig.compilerOptions.paths
    ) {
      return parsedTSConfig.compilerOptions.paths;
    } else if (parsedTSConfig.extends) {
      return readPaths(resolve(dirname(tsConfig), parsedTSConfig.extends));
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}

export function createTmpTsConfig(
  tsconfigPath: string,
  workspaceRoot: string,
  projectRoot: string,
  dependencies: DependentBuildableProjectNode[]
) {
  const tmpTsConfigPath = join(
    workspaceRoot,
    'tmp',
    projectRoot,
    'tsconfig.generated.json'
  );
  const parsedTSConfig = readTsConfigWithRemappedPaths(
    tsconfigPath,
    tmpTsConfigPath,
    dependencies
  );
  process.on('exit', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
  });
  process.on('SIGTERM', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
    process.exit(0);
  });
  process.on('SIGINT', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
    process.exit(0);
  });
  writeJsonFile(tmpTsConfigPath, parsedTSConfig);
  return join(tmpTsConfigPath);
}

function cleanupTmpTsConfigFile(tmpTsConfigPath) {
  try {
    if (tmpTsConfigPath) {
      unlinkSync(tmpTsConfigPath);
    }
  } catch (e) {}
}

export function checkDependentProjectsHaveBeenBuilt(
  context: BuilderContext,
  projectDependencies: DependentBuildableProjectNode[]
): boolean {
  const depLibsToBuildFirst: DependentBuildableProjectNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach((dep) => {
    if (dep.node.type !== ProjectType.lib) {
      return;
    }

    const paths = dep.outputs.map((p) =>
      join(context.workspaceRoot, p, 'package.json')
    );

    if (!paths.some(fileExists)) {
      depLibsToBuildFirst.push(dep);
    }
  });

  if (depLibsToBuildFirst.length > 0) {
    context.logger.error(stripIndents`
      Some of the project ${
        context.target.project
      }'s dependencies have not been built yet. Please build these libraries before:
      ${depLibsToBuildFirst.map((x) => ` - ${x.node.name}`).join('\n')}

      Try: nx run ${context.target.project}:${context.target.target} --with-deps
    `);

    return false;
  } else {
    return true;
  }
}

export function updatePaths(
  dependencies: DependentBuildableProjectNode[],
  paths: Record<string, string[]>
) {
  const pathsKeys = Object.keys(paths);
  dependencies.forEach((dep) => {
    if (dep.outputs && dep.outputs.length > 0) {
      paths[dep.name] = dep.outputs;
      // check for secondary entrypoints, only available for ng-packagr projects
      for (const path of pathsKeys) {
        if (path.startsWith(`${dep.name}/`)) {
          const [, nestedPart] = path.split(`${dep.name}/`);
          paths[path] = dep.outputs.map((o) => `${o}/${nestedPart}`);
        }
      }
    }
  });
}

/**
 * Updates the peerDependencies section in the `dist/lib/xyz/package.json` with
 * the proper dependency and version
 */
export function updateBuildableProjectPackageJsonDependencies(
  context: BuilderContext,
  node: ProjectGraphNode,
  dependencies: DependentBuildableProjectNode[],
  typeOfDependency: 'dependencies' | 'peerDependencies' = 'dependencies'
) {
  const outputs = getOutputsForTargetAndConfiguration(
    {
      overrides: {},
      target: context.target,
    },
    node
  );

  const packageJsonPath = `${outputs[0]}/package.json`;
  let packageJson;
  let workspacePackageJson;
  try {
    packageJson = readJsonFile(packageJsonPath);
    workspacePackageJson = readJsonFile(
      `${context.workspaceRoot}/package.json`
    );
  } catch (e) {
    // cannot find or invalid package.json
    return;
  }

  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.peerDependencies = packageJson.peerDependencies || {};

  let updatePackageJson = false;
  dependencies.forEach((entry) => {
    const packageName =
      entry.node.type === 'npm' ? entry.node.data.packageName : entry.name;

    if (
      !hasDependency(packageJson, 'dependencies', packageName) &&
      !hasDependency(packageJson, 'devDependencies', packageName) &&
      !hasDependency(packageJson, 'peerDependencies', packageName)
    ) {
      try {
        let depVersion;
        if (entry.node.type === ProjectType.lib) {
          const outputs = getOutputsForTargetAndConfiguration(
            {
              overrides: {},
              target: context.target,
            },
            entry.node
          );

          const depPackageJsonPath = join(
            context.workspaceRoot,
            outputs[0],
            'package.json'
          );
          depVersion = readJsonFile(depPackageJsonPath).version;

          packageJson[typeOfDependency][packageName] = depVersion;
        } else if (entry.node.type === 'npm') {
          // If an npm dep is part of the workspace devDependencies, do not include it the library
          if (
            !!workspacePackageJson.devDependencies?.[
              entry.node.data.packageName
            ]
          ) {
            return;
          }

          depVersion = entry.node.data.version;

          packageJson[typeOfDependency][
            entry.node.data.packageName
          ] = depVersion;
        }
        updatePackageJson = true;
      } catch (e) {
        // skip if cannot find package.json
      }
    }
  });

  if (updatePackageJson) {
    writeJsonFile(packageJsonPath, packageJson);
  }
}

// verify whether the package.json already specifies the dep
function hasDependency(outputJson, depConfigName: string, packageName: string) {
  if (outputJson[depConfigName]) {
    return outputJson[depConfigName][packageName];
  } else {
    return false;
  }
}

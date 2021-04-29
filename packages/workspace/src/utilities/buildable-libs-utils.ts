import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectType,
} from '../core/project-graph';
import { join, resolve, dirname, relative, parse } from 'path';
import { fileExists, readJsonFile, writeJsonFile } from './fileutils';
import { stripIndents, TargetDependencyConfig } from '@nrwl/devkit';
import {
  getDefaultDependencyConfigs,
  getDependencyConfigs,
  getOutputsForTargetAndConfiguration,
} from '../tasks-runner/utils';
import * as ts from 'typescript';
import { unlinkSync } from 'fs';
import { output } from './output';
import { readNxJson } from '../core/file-utils';

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
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string
): { target: ProjectGraphNode; dependencies: DependentBuildableProjectNode[] } {
  const target = projGraph.nodes[projectName];
  // gather the library dependencies
  const dependencies = recursivelyCollectDependencies(
    projectName,
    projGraph,
    []
  )
    .map((dep) => {
      const depNode = projGraph.nodes[dep];
      if (
        depNode.type === ProjectType.lib &&
        isBuildable(targetName, depNode)
      ) {
        const libPackageJson = readJsonFile(
          join(root, depNode.data.root, 'package.json')
        );

        return {
          name: libPackageJson.name, // i.e. @workspace/mylib
          outputs: getOutputsForTargetAndConfiguration(
            {
              overrides: {},
              target: {
                project: projectName,
                target: targetName,
                configuration: configurationName,
              },
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

export function calculateProjectTargetDependencies(
  projectGraph: ProjectGraph,
  workspaceRoot: string,
  projectName: string,
  targetName: string,
  configurationName: string
): { target: ProjectGraphNode; dependencies: DependentBuildableProjectNode[] } {
  const nxJson = readNxJson();
  const defaultDependencyConfigs = getDefaultDependencyConfigs(nxJson);
  const dependencies = recursivelyCollectProjectTargetDependencies(
    projectName,
    targetName,
    projectGraph,
    defaultDependencyConfigs,
    []
  )
    .map(({ dependencyName, targetName: depTargetName }) =>
      toDependentBuildableProjectNode(
        dependencyName,
        projectName,
        depTargetName,
        configurationName,
        workspaceRoot,
        projectGraph
      )
    )
    .filter((x) => !!x);

  return { target: projectGraph.nodes[projectName], dependencies };
}

function recursivelyCollectProjectTargetDependencies(
  projectName: string,
  targetName: string,
  projectGraph: ProjectGraph,
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]>,
  deps: Array<{ dependencyName: string; targetName: string }>
): Array<{ dependencyName: string; targetName: string }> {
  const dependencyConfigs = getDependencyConfigs(
    { project: projectName, target: targetName },
    defaultDependencyConfigs,
    projectGraph
  );
  dependencyConfigs.forEach((depConfig) => {
    if (depConfig.projects === 'dependencies') {
      projectGraph.dependencies[projectName].forEach((dep) => {
        const projectNode = projectGraph.nodes[dep.target];
        if (!deps.some((d) => d.dependencyName === dep.target)) {
          deps.push({
            dependencyName: dep.target,
            targetName: depConfig.target,
          });
        }
        if (projectNode.type !== 'lib') {
          return;
        }
        deps = recursivelyCollectProjectTargetDependencies(
          dep.target,
          depConfig.target,
          projectGraph,
          defaultDependencyConfigs,
          deps
        );
      });
    } else {
      deps = recursivelyCollectProjectTargetDependencies(
        projectName,
        depConfig.target,
        projectGraph,
        defaultDependencyConfigs,
        deps
      );
    }
  });

  return deps;
}

function toDependentBuildableProjectNode(
  dependency: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  workspaceRoot: string,
  projectGraph: ProjectGraph
): DependentBuildableProjectNode {
  const depNode = projectGraph.nodes[dependency];
  if (depNode.type === 'lib') {
    const libPackageJson = readJsonFile(
      join(workspaceRoot, depNode.data.root, 'package.json')
    );

    return {
      name: libPackageJson.name,
      outputs: getOutputsForTargetAndConfiguration(
        {
          overrides: {},
          target: {
            project: projectName,
            target: targetName,
            configuration: configurationName,
          },
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

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    output.log({
      title: 'TypeScript path mappings have been rewritten.',
      bodyLines: [
        JSON.stringify(generatedTsConfig.compilerOptions.paths, null, 2),
      ],
    });
  }
  return generatedTsConfig;
}

export function computeCompilerOptionsPaths(
  tsConfig: string,
  dependencies: DependentBuildableProjectNode[]
) {
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
  const tmpTsConfigPath = generateTmpFilePathFromFile(
    tsconfigPath,
    workspaceRoot,
    projectRoot
  );
  const parsedTSConfig = readTsConfigWithRemappedPaths(
    tsconfigPath,
    tmpTsConfigPath,
    dependencies
  );
  process.on('exit', () => removeFile(tmpTsConfigPath));
  writeJsonFile(tmpTsConfigPath, parsedTSConfig);
  return join(tmpTsConfigPath);
}

export function createTmpJestConfig(
  workspaceRoot: string,
  projectRoot: string,
  jestConfig: any
): string {
  const tmpJestConfigPath = generateTmpFilePathFromFile(
    'jest.config.js',
    workspaceRoot,
    projectRoot,
    '.json'
  );
  process.on('exit', () => removeFile(tmpJestConfigPath));
  writeJsonFile(tmpJestConfigPath, jestConfig);
  return join(tmpJestConfigPath);
}

export function getTmpProjectRoot(
  workspaceRoot: string,
  projectRoot: string
): string {
  return join(workspaceRoot, 'tmp', projectRoot);
}

export function generateTmpFilePathFromFile(
  file: string,
  workspaceRoot: string,
  projectRoot: string,
  newExt?: string
): string {
  const { name, ext } = parse(file);
  let tmpExt = newExt ?? ext;
  if (tmpExt.startsWith('.')) {
    tmpExt = tmpExt.slice(1);
  }
  return join(
    getTmpProjectRoot(workspaceRoot, projectRoot),
    `${name}.generated.${tmpExt}`
  );
}

function removeFile(filePath: string): void {
  try {
    if (filePath) {
      unlinkSync(filePath);
    }
  } catch (e) {}
}

export function checkDependentProjectsHaveBeenBuilt(
  root: string,
  projectName: string,
  targetName: string,
  projectDependencies: DependentBuildableProjectNode[]
): boolean {
  const missing = findMissingBuildDependencies(
    root,
    projectName,
    targetName,
    projectDependencies
  );
  if (missing.length > 0) {
    console.error(stripIndents`
      Some of the project ${projectName}'s dependencies have not been built yet. Please build these libraries before:
      ${missing.map((x) => ` - ${x.node.name}`).join('\n')}

      Try: nx run ${projectName}:${targetName} --with-deps
    `);
    return false;
  } else {
    return true;
  }
}

export function findMissingBuildDependencies(
  root: string,
  projectName: string,
  targetName: string,
  projectDependencies: DependentBuildableProjectNode[]
): DependentBuildableProjectNode[] {
  const depLibsToBuildFirst: DependentBuildableProjectNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach((dep) => {
    if (dep.node.type !== ProjectType.lib) {
      return;
    }

    const paths = dep.outputs.map((p) => join(root, p, 'package.json'));

    if (!paths.some(fileExists)) {
      depLibsToBuildFirst.push(dep);
    }
  });

  return depLibsToBuildFirst;
}

export function updatePaths(
  dependencies: DependentBuildableProjectNode[],
  paths: Record<string, string[]>
) {
  const pathsKeys = Object.keys(paths);
  dependencies.forEach((dep) => {
    if (shouldUpdateDependencyPaths(dep)) {
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

export function shouldUpdateDependencyPaths(
  dependency: DependentBuildableProjectNode
): boolean {
  return dependency.outputs && dependency.outputs.length > 0;
}

/**
 * Updates the peerDependencies section in the `dist/lib/xyz/package.json` with
 * the proper dependency and version
 */
export function updateBuildableProjectPackageJsonDependencies(
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  node: ProjectGraphNode,
  dependencies: DependentBuildableProjectNode[],
  typeOfDependency: 'dependencies' | 'peerDependencies' = 'dependencies'
) {
  const outputs = getOutputsForTargetAndConfiguration(
    {
      overrides: {},
      target: {
        project: projectName,
        target: targetName,
        configuration: configurationName,
      },
    },
    node
  );

  const packageJsonPath = `${outputs[0]}/package.json`;
  let packageJson;
  let workspacePackageJson;
  try {
    packageJson = readJsonFile(packageJsonPath);
    workspacePackageJson = readJsonFile(`${root}/package.json`);
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
              target: {
                project: projectName,
                target: targetName,
                configuration: configurationName,
              },
            },
            entry.node
          );

          const depPackageJsonPath = join(root, outputs[0], 'package.json');
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

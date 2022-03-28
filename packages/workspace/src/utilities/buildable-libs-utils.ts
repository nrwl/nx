import { dirname, join, relative, resolve } from 'path';
import { directoryExists } from './fileutils';
import type { ProjectGraph, ProjectGraphProjectNode } from '@nrwl/devkit';
import {
  ProjectGraphExternalNode,
  readJsonFile,
  stripIndents,
  writeJsonFile,
  getOutputsForTargetAndConfiguration,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import { unlinkSync } from 'fs';
import { output } from './output';
import { isNpmProject } from 'nx/src/core/project-graph/operators';

function isBuildable(target: string, node: ProjectGraphProjectNode): boolean {
  return (
    node.data.targets &&
    node.data.targets[target] &&
    node.data.targets[target].executor !== ''
  );
}

export type DependentBuildableProjectNode = {
  name: string;
  outputs: string[];
  node: ProjectGraphProjectNode | ProjectGraphExternalNode;
};

export function calculateProjectDependencies(
  projGraph: ProjectGraph,
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  shallow?: boolean
): {
  target: ProjectGraphProjectNode;
  dependencies: DependentBuildableProjectNode[];
  nonBuildableDependencies: string[];
  topLevelDependencies: DependentBuildableProjectNode[];
} {
  const target = projGraph.nodes[projectName];
  // gather the library dependencies
  const nonBuildableDependencies = [];
  const topLevelDependencies: DependentBuildableProjectNode[] = [];
  const dependencies = collectDependencies(projectName, projGraph, [], shallow)
    .map(({ name: dep, isTopLevel }) => {
      let project: DependentBuildableProjectNode = null;
      const depNode = projGraph.nodes[dep] || projGraph.externalNodes[dep];
      if (depNode.type === 'lib') {
        if (isBuildable(targetName, depNode)) {
          const libPackageJson = readJsonFile(
            join(root, depNode.data.root, 'package.json')
          );

          project = {
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
        } else {
          nonBuildableDependencies.push(dep);
        }
      } else if (depNode.type === 'npm') {
        project = {
          name: depNode.data.packageName,
          outputs: [],
          node: depNode,
        };
      }

      if (project && isTopLevel) {
        topLevelDependencies.push(project);
      }

      return project;
    })
    .filter((x) => !!x);
  return {
    target,
    dependencies,
    nonBuildableDependencies,
    topLevelDependencies,
  };
}

function collectDependencies(
  project: string,
  projGraph: ProjectGraph,
  acc: { name: string; isTopLevel: boolean }[],
  shallow?: boolean,
  areTopLevelDeps = true
): { name: string; isTopLevel: boolean }[] {
  (projGraph.dependencies[project] || []).forEach((dependency) => {
    if (!acc.some((dep) => dep.name === dependency.target)) {
      acc.push({ name: dependency.target, isTopLevel: areTopLevelDeps });
      if (!shallow) {
        collectDependencies(dependency.target, projGraph, acc, shallow, false);
      }
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

  if (process.env.NX_VERBOSE_LOGGING_PATH_MAPPINGS === 'true') {
    output.log({
      title: 'TypeScript path mappings have been rewritten.',
    });
    console.log(
      JSON.stringify(generatedTsConfig.compilerOptions.paths, null, 2)
    );
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
  process.on('exit', () => cleanupTmpTsConfigFile(tmpTsConfigPath));
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
  if (missing.length === projectDependencies.length && missing.length > 0) {
    console.error(stripIndents`
      It looks like all of ${projectName}'s dependencies have not been built yet:
      ${missing.map((x) => ` - ${x.node.name}`).join('\n')}

      You might be missing a "targetDependencies" configuration in your root nx.json (https://nx.dev/configuration/packagejson#target-dependencies),
      or "dependsOn" configured in ${projectName}'s angular.json/workspace.json record or project.json (https://nx.dev/configuration/packagejson#dependson) 
    `);
  } else if (missing.length > 0) {
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
    if (dep.node.type !== 'lib') {
      return;
    }

    const paths = dep.outputs.map((p) => join(root, p));

    if (!paths.some(directoryExists)) {
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
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  node: ProjectGraphProjectNode,
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
    const packageName = isNpmProject(entry.node)
      ? entry.node.data.packageName
      : entry.name;

    if (
      !hasDependency(packageJson, 'dependencies', packageName) &&
      !hasDependency(packageJson, 'devDependencies', packageName) &&
      !hasDependency(packageJson, 'peerDependencies', packageName)
    ) {
      try {
        let depVersion;
        if (entry.node.type === 'lib') {
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
        } else if (isNpmProject(entry.node)) {
          // If an npm dep is part of the workspace devDependencies, do not include it the library
          if (
            !!workspacePackageJson.devDependencies?.[
              entry.node.data.packageName
            ]
          ) {
            return;
          }

          depVersion = entry.node.data.version;

          packageJson[typeOfDependency][entry.node.data.packageName] =
            depVersion;
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

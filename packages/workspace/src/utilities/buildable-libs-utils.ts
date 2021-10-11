import type { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { stripIndents } from '@nrwl/devkit';
import { unlinkSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import * as ts from 'typescript';
import { readNxJson } from '../core/file-utils';
import { isNpmProject, ProjectType } from '../core/project-graph';
import { TypeScriptImportLocator } from '../core/project-graph/build-dependencies/typescript-import-locator';
import { TargetProjectLocator } from '../core/target-project-locator';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import { directoryExists, readJsonFile, writeJsonFile } from './fileutils';
import { output } from './output';
import { resolveModuleByImport } from './typescript';

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
  const dependencyNames = recursivelyCollectDependencies(
    projectName,
    projGraph,
    []
  );
  const dependencies = buildDependentBuildableProjectNodeArray(
    dependencyNames,
    projGraph,
    root,
    projectName,
    targetName,
    configurationName
  );

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

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
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

export function calculateDependenciesFromEntryPoint(
  projectGraph: ProjectGraph,
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  entryPoint: string
): { target: ProjectGraphNode; dependencies: DependentBuildableProjectNode[] } {
  const dependencyNames = recursivelyCollectDependenciesFromFile(
    entryPoint,
    projectName,
    targetName,
    configurationName,
    projectGraph
  );
  const dependencies = buildDependentBuildableProjectNodeArray(
    dependencyNames,
    projectGraph,
    root,
    projectName,
    targetName,
    configurationName
  );

  return { target: projectGraph.nodes[projectName], dependencies };
}

function recursivelyCollectDependenciesFromFile(
  file: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  projectGraph: ProjectGraph,
  seenFiles: Set<string> = new Set(),
  seenTargets: Set<string> = new Set(),
  importLocator = new TypeScriptImportLocator(),
  targetProjectLocator = new TargetProjectLocator(
    projectGraph.nodes,
    projectGraph.externalNodes
  ),
  npmScope: string = readNxJson().npmScope
): string[] {
  const dependencies: string[] = [];
  seenFiles.add(file);

  // visit file imports
  importLocator.fromFile(file, (importExpr, filePath, type) => {
    // find the project that the import belongs to
    const target = targetProjectLocator.findProjectWithImport(
      importExpr,
      file,
      npmScope
    );

    // add the dependency if it is not self-referencing and it hasn't been seen before
    if (target && target !== projectName && !seenTargets.has(target)) {
      seenTargets.add(target);
      dependencies.push(target);
    }

    // stop if the import is an external module
    if (projectGraph.externalNodes[target]) {
      return;
    }

    // get the file path of the import
    const resolvedFile = resolveModuleByImport(
      importExpr,
      filePath,
      'tsconfig.base.json'
    );

    // stop if the file path was not resolved or if it has already been seen
    if (!resolvedFile || seenFiles.has(resolvedFile)) {
      return;
    }

    // recursively collect dependencies from the file
    const deps = recursivelyCollectDependenciesFromFile(
      resolvedFile,
      projectName,
      targetName,
      configurationName,
      projectGraph,
      seenFiles,
      seenTargets,
      importLocator,
      targetProjectLocator,
      npmScope
    );

    dependencies.push(...deps);
  });

  return dependencies;
}

function buildDependentBuildableProjectNodeArray(
  dependencies: string[],
  projectGraph: ProjectGraph,
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string
): DependentBuildableProjectNode[] {
  return dependencies
    .map((dep) => {
      const depNode =
        projectGraph.nodes[dep] || projectGraph.externalNodes[dep];
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
      }

      if (isNpmProject(depNode)) {
        return {
          name: depNode.data.packageName,
          outputs: [],
          node: depNode,
        };
      }

      return null;
    })
    .filter(Boolean);
}

// verify whether the package.json already specifies the dep
function hasDependency(outputJson, depConfigName: string, packageName: string) {
  if (outputJson[depConfigName]) {
    return outputJson[depConfigName][packageName];
  } else {
    return false;
  }
}

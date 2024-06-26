import type {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
  TaskGraph,
} from '@nx/devkit';
import {
  getOutputsForTargetAndConfiguration,
  parseTargetString,
  readJsonFile,
  stripIndents,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { unlinkSync } from 'fs';
import { isNpmProject } from 'nx/src/project-graph/operators';
import { directoryExists, fileExists } from 'nx/src/utils/fileutils';
import { output } from 'nx/src/utils/output';
import { dirname, join, relative, isAbsolute } from 'path';
import type * as ts from 'typescript';
import { readTsConfigPaths } from './typescript/ts-config';

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

export function calculateProjectBuildableDependencies(
  taskGraph: TaskGraph | undefined,
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
  if (process.env.NX_BUILDABLE_LIBRARIES_TASK_GRAPH === 'true' && taskGraph) {
    return calculateDependenciesFromTaskGraph(
      taskGraph,
      projGraph,
      root,
      projectName,
      targetName,
      configurationName,
      shallow
    );
  }

  return calculateProjectDependencies(
    projGraph,
    root,
    projectName,
    targetName,
    configurationName,
    shallow
  );
}

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
  const collectedDeps = collectDependencies(
    projectName,
    projGraph,
    [],
    shallow
  );
  const missing = collectedDeps.reduce(
    (missing: string[] | undefined, { name: dep }) => {
      const depNode = projGraph.nodes[dep] || projGraph.externalNodes[dep];
      if (!depNode) {
        missing = missing || [];
        missing.push(dep);
      }
      return missing;
    },
    null
  );
  if (missing) {
    throw new Error(`Unable to find ${missing.join(', ')} in project graph.`);
  }
  const dependencies = collectedDeps
    .map(({ name: dep, isTopLevel }) => {
      let project: DependentBuildableProjectNode = null;
      const depNode = projGraph.nodes[dep] || projGraph.externalNodes[dep];
      if (depNode.type === 'lib') {
        if (isBuildable(targetName, depNode)) {
          const libPackageJsonPath = join(
            root,
            depNode.data.root,
            'package.json'
          );

          project = {
            name: fileExists(libPackageJsonPath)
              ? readJsonFile(libPackageJsonPath).name // i.e. @workspace/mylib
              : dep,
            outputs: getOutputsForTargetAndConfiguration(
              {
                project: projectName,
                target: targetName,
                configuration: configurationName,
              },
              {},
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

  dependencies.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

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
    const existingEntry = acc.find((dep) => dep.name === dependency.target);
    if (!existingEntry) {
      // Temporary skip this. Currently the set of external nodes is built from package.json, not lock file.
      // As a result, some nodes might be missing. This should not cause any issues, we can just skip them.
      if (
        dependency.target.startsWith('npm:') &&
        !projGraph.externalNodes[dependency.target]
      )
        return;

      acc.push({ name: dependency.target, isTopLevel: areTopLevelDeps });
      const isInternalTarget = projGraph.nodes[dependency.target];
      if (!shallow && isInternalTarget) {
        collectDependencies(dependency.target, projGraph, acc, shallow, false);
      }
    } else if (areTopLevelDeps && !existingEntry.isTopLevel) {
      existingEntry.isTopLevel = true;
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
  const dirnameTsConfig = dirname(generatedTsConfigPath);
  const relativeTsconfig = isAbsolute(dirnameTsConfig)
    ? relative(workspaceRoot, dirnameTsConfig)
    : dirnameTsConfig;
  generatedTsConfig.extends = relative(relativeTsconfig, tsConfig);
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

export function calculateDependenciesFromTaskGraph(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
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
  const target = projectGraph.nodes[projectName];
  const nonBuildableDependencies = [];
  const topLevelDependencies: DependentBuildableProjectNode[] = [];

  const dependentTasks = collectDependentTasks(
    projectName,
    `${projectName}:${targetName}${
      configurationName ? `:${configurationName}` : ''
    }`,
    taskGraph,
    projectGraph,
    shallow
  );

  const npmDependencies = collectNpmDependencies(
    projectName,
    projectGraph,
    !shallow ? dependentTasks : undefined
  );

  const dependencies: DependentBuildableProjectNode[] = [];
  for (const [taskName, { isTopLevel }] of dependentTasks) {
    let project: DependentBuildableProjectNode = null;
    const depTask = taskGraph.tasks[taskName];
    const depProjectNode = projectGraph.nodes?.[depTask.target.project];
    if (depProjectNode?.type !== 'lib') {
      continue;
    }

    let outputs = getOutputsForTargetAndConfiguration(
      depTask.target,
      depTask.overrides,
      depProjectNode
    );

    if (outputs.length === 0) {
      nonBuildableDependencies.push(depTask.target.project);
      continue;
    }

    const libPackageJsonPath = join(
      root,
      depProjectNode.data.root,
      'package.json'
    );

    project = {
      name: fileExists(libPackageJsonPath)
        ? readJsonFile(libPackageJsonPath).name // i.e. @workspace/mylib
        : depTask.target.project,
      outputs,
      node: depProjectNode,
    };

    if (isTopLevel) {
      topLevelDependencies.push(project);
    }

    dependencies.push(project);
  }

  for (const { project, isTopLevel } of npmDependencies) {
    if (isTopLevel) {
      topLevelDependencies.push(project);
    }

    dependencies.push(project);
  }

  dependencies.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

  return {
    target,
    dependencies,
    nonBuildableDependencies,
    topLevelDependencies,
  };
}

function collectNpmDependencies(
  projectName: string,
  projectGraph: ProjectGraph,
  dependentTasks:
    | Map<string, { project: string; isTopLevel: boolean }>
    | undefined,
  collectedPackages = new Set<string>(),
  isTopLevel = true
): Array<{ project: DependentBuildableProjectNode; isTopLevel: boolean }> {
  const dependencies: Array<{
    project: DependentBuildableProjectNode;
    isTopLevel: boolean;
  }> = projectGraph.dependencies[projectName]
    .map((dep) => {
      const projectNode =
        projectGraph.nodes?.[dep.target] ??
        projectGraph.externalNodes?.[dep.target];
      if (
        projectNode?.type !== 'npm' ||
        collectedPackages.has(projectNode.data.packageName)
      ) {
        return null;
      }

      const project = {
        name: projectNode.data.packageName,
        outputs: [],
        node: projectNode,
      };
      collectedPackages.add(project.name);

      return { project, isTopLevel };
    })
    .filter((x) => !!x);

  if (dependentTasks?.size) {
    for (const [, { project: projectName }] of dependentTasks) {
      dependencies.push(
        ...collectNpmDependencies(
          projectName,
          projectGraph,
          undefined,
          collectedPackages,
          false
        )
      );
    }
  }

  return dependencies;
}

function collectDependentTasks(
  project: string,
  task: string,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  shallow?: boolean,
  areTopLevelDeps = true,
  dependentTasks = new Map<string, { project: string; isTopLevel: boolean }>()
): Map<string, { project: string; isTopLevel: boolean }> {
  for (const depTask of taskGraph.dependencies[task] ?? []) {
    if (dependentTasks.has(depTask)) {
      if (!dependentTasks.get(depTask).isTopLevel && areTopLevelDeps) {
        dependentTasks.get(depTask).isTopLevel = true;
      }
      continue;
    }

    const { project: depTaskProject } = parseTargetString(
      depTask,
      projectGraph
    );
    if (depTaskProject !== project) {
      dependentTasks.set(depTask, {
        project: depTaskProject,
        isTopLevel: areTopLevelDeps,
      });
    }

    if (!shallow) {
      collectDependentTasks(
        depTaskProject,
        depTask,
        taskGraph,
        projectGraph,
        shallow,
        depTaskProject === project && areTopLevelDeps,
        dependentTasks
      );
    }
  }

  return dependentTasks;
}

/**
 * Util function to create tsconfig compilerOptions object with support for workspace libs paths.
 *
 *
 *
 * @param tsConfig String of config path or object parsed via ts.parseJsonConfigFileContent.
 * @param dependencies Dependencies calculated by Nx.
 */
export function computeCompilerOptionsPaths(
  tsConfig: string | ts.ParsedCommandLine,
  dependencies: DependentBuildableProjectNode[]
) {
  const paths = readTsConfigPaths(tsConfig) || {};
  updatePaths(dependencies, paths);
  return paths;
}

export function createTmpTsConfig(
  tsconfigPath: string,
  workspaceRoot: string,
  projectRoot: string,
  dependencies: DependentBuildableProjectNode[],
  useWorkspaceAsBaseUrl: boolean = false
) {
  const tmpTsConfigPath = join(
    workspaceRoot,
    'tmp',
    projectRoot,
    process.env.NX_TASK_TARGET_TARGET ?? 'build',
    'tsconfig.generated.json'
  );
  const parsedTSConfig = readTsConfigWithRemappedPaths(
    tsconfigPath,
    tmpTsConfigPath,
    dependencies
  );
  process.on('exit', () => cleanupTmpTsConfigFile(tmpTsConfigPath));

  if (useWorkspaceAsBaseUrl) {
    parsedTSConfig.compilerOptions ??= {};
    parsedTSConfig.compilerOptions.baseUrl = workspaceRoot;
  }

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
      It looks like all of ${projectName}'s dependencies have not been built yet:
      ${missing.map((x) => ` - ${x.node.name}`).join('\n')}

      You might be missing a "targetDefaults" configuration in your root nx.json (https://nx.dev/reference/project-configuration#target-defaults),
      or "dependsOn" configured in ${projectName}'s project.json (https://nx.dev/reference/project-configuration#dependson) 
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
  // For each registered dependency
  dependencies.forEach((dep) => {
    // If there are outputs
    if (dep.outputs && dep.outputs.length > 0) {
      // Directly map the dependency name to the output paths (dist/packages/..., etc.)
      paths[dep.name] = dep.outputs;

      // check for secondary entrypoints
      // For each registered path
      for (const path of pathsKeys) {
        const nestedName = `${dep.name}/`;

        // If the path points to the current dependency and is nested (/)
        if (path.startsWith(nestedName)) {
          const nestedPart = path.slice(nestedName.length);

          // Bind secondary endpoints for ng-packagr projects
          let mappedPaths = dep.outputs.map(
            (output) => `${output}/${nestedPart}`
          );

          // Get the dependency's package name
          const { root } = (dep.node?.data || {}) as any;
          if (root) {
            // Update nested mappings to point to the dependency's output paths
            mappedPaths = mappedPaths.concat(
              paths[path].flatMap((path) =>
                dep.outputs.map((output) => path.replace(root, output))
              )
            );
          }

          paths[path] = mappedPaths;
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
      project: projectName,
      target: targetName,
      configuration: configurationName,
    },
    {},
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
              project: projectName,
              target: targetName,
              configuration: configurationName,
            },
            {},
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

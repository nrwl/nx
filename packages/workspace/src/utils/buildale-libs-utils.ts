import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectType
} from '../core/project-graph';
import { BuilderContext } from '@angular-devkit/architect';
import { join } from 'path';
import {
  fileExists,
  readJsonFile,
  writeJsonFile
} from '@nrwl/workspace/src/utils/fileutils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function isBuildable(projectGraph: ProjectGraphNode): boolean {
  return (
    projectGraph.data.architect &&
    projectGraph.data.architect.build &&
    projectGraph.data.architect.build.builder !== ''
  );
}

function getOutputPath(projectGraph: ProjectGraphNode): string {
  const opts = projectGraph.data.architect.build.options;
  if (opts && opts.outputPath) {
    return opts.outputPath;
  } else {
    return `dist/${projectGraph.data.root}`;
  }
}

export type DependentBuildableProjectNode = {
  name: string;
  node: ProjectGraphNode;
};

export function calculateProjectDependencies(
  projGraph: ProjectGraph,
  context: BuilderContext
): { target: ProjectGraphNode; dependencies: DependentBuildableProjectNode[] } {
  const target = projGraph.nodes[context.target.project];
  // gather the library dependencies
  const dependencies = (projGraph.dependencies[context.target.project] || [])
    .map(dependency => {
      const depNode = projGraph.nodes[dependency.target];

      if (depNode.type === ProjectType.lib && isBuildable(depNode)) {
        const libPackageJson = readJsonFile(
          join(context.workspaceRoot, depNode.data.root, 'package.json')
        );

        return {
          name: libPackageJson.name, // i.e. @workspace/mylib
          node: depNode
        };
      } else {
        return null;
      }
    })
    .filter(x => !!x);
  return { target, dependencies };
}

export function checkDependentProjectsHaveBeenBuilt(
  context: BuilderContext,
  projectDependencies: DependentBuildableProjectNode[]
): boolean {
  const depLibsToBuildFirst: DependentBuildableProjectNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach(dep => {
    // check whether dependent library has been built => that's necessary
    const packageJsonPath = join(
      context.workspaceRoot,
      getOutputPath(dep.node),
      'package.json'
    );

    if (!fileExists(packageJsonPath)) {
      depLibsToBuildFirst.push(dep);
    }
  });

  if (depLibsToBuildFirst.length > 0) {
    context.logger.error(stripIndents`
      Some of the project ${
        context.target.project
      }'s dependencies have not been built yet. Please build these libraries before:
      ${depLibsToBuildFirst.map(x => ` - ${x.node.name}`).join('\n')}

      Try: nx run-many --target build --projects ${context.target.project},...
    `);

    return false;
  } else {
    return true;
  }
}

export function updatePaths(
  dependencies: DependentBuildableProjectNode[],
  paths: { [k: string]: string[] }
) {
  dependencies.forEach(depp => {
    if (isBuildable(depp.node)) {
      paths[depp.name] = [getOutputPath(depp.node)];
    }
  });
}

/**
 * Updates the peerDependencies section in the `dist/lib/xyz/package.json` with
 * the proper dependency and version
 */
export function updateBuildableProjectPackageJsonDependencies(
  context: BuilderContext,
  target: ProjectGraphNode,
  dependencies: DependentBuildableProjectNode[]
) {
  // if we have dependencies, update the `dependencies` section of the package.json
  const packageJsonPath = `${getOutputPath(target)}/package.json`;
  const packageJson = readJsonFile(packageJsonPath);

  packageJson.dependencies = packageJson.dependencies || {};

  let updatePackageJson = false;
  dependencies.forEach(entry => {
    if (
      !hasDependency(packageJson, 'dependencies', entry.name) &&
      !hasDependency(packageJson, 'devDependencies', entry.name) &&
      !hasDependency(packageJson, 'peerDependencies', entry.name)
    ) {
      // read the lib version (should we read the one from the dist?)
      const depPackageJsonPath = join(
        context.workspaceRoot,
        getOutputPath(entry.node),
        'package.json'
      );
      const depPackageJson = readJsonFile(depPackageJsonPath);

      packageJson.dependencies[entry.name] = depPackageJson.version;
      updatePackageJson = true;
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

import { BuilderContext } from '@angular-devkit/architect';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { getOutputsForTargetAndConfiguration } from '@nrwl/workspace/src/tasks-runner/utils';
import {
  fileExists,
  readJsonFile,
  writeJsonFile
} from '@nrwl/workspace/src/utils/fileutils';
import { join } from 'path';

import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectType
} from '../core/project-graph';

function isBuildable(target: string, node: ProjectGraphNode): boolean {
  return (
    node.data.architect &&
    node.data.architect[target] &&
    node.data.architect[target].builder !== ''
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
  const dependencies = (projGraph.dependencies[context.target.project] || [])
    .map(dependency => {
      const depNode = projGraph.nodes[dependency.target];

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
            context.target.target,
            context.target.configuration,
            depNode
          ),
          node: depNode
        };
      } else {
        return null;
      }
    })
    .filter(x => !!x);
  return { target, dependencies };
}

interface NgPackagrOptions {
  dest?: string;
  [key: string]: any;
}

export function getNgPackgrOptions(
  basePath: string
): NgPackagrOptions | undefined {
  const srcNgPackagePath = join(basePath, 'ng-package.json');
  if (fileExists(srcNgPackagePath)) {
    return readJsonFile<NgPackagrOptions>(srcNgPackagePath);
  }
  const srcPackageJsonPath = join(basePath, 'package.json');
  if (fileExists(srcPackageJsonPath)) {
    const packageJsonInfo = readJsonFile<{
      ngPackage?: {
        dest?: string;
      };
    }>(srcPackageJsonPath);
    return packageJsonInfo.ngPackage;
  }

  return undefined;
}

export function checkDependentProjectsHaveBeenBuilt(
  context: BuilderContext,
  projectDependencies: DependentBuildableProjectNode[]
): boolean {
  const depLibsToBuildFirst: DependentBuildableProjectNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach(dep => {
    const paths = dep.outputs.map(p => {
      if (dep.node.data.root) {
        const projectDir = join(context.workspaceRoot, dep.node.data.root);
        const options = getNgPackgrOptions(projectDir);
        if (options && options.dest) {
          return join(projectDir, options.dest, 'package.json');
        }
      }
      return join(context.workspaceRoot, p, 'package.json');
    });

    if (!paths.some(fileExists)) {
      depLibsToBuildFirst.push(dep);
    }
  });

  if (depLibsToBuildFirst.length > 0) {
    context.logger.error(stripIndents`
      Some of the project ${
        context.target.project
      }'s dependencies have not been built yet. Please build these libraries before:
      ${depLibsToBuildFirst.map(x => ` - ${x.node.name}`).join('\n')}

      Try: nx run-many --target ${context.target.target} --projects ${
      context.target.project
    },...
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
  dependencies.forEach(dep => {
    if (dep.outputs && dep.outputs.length > 0) {
      paths[dep.name] = dep.outputs;
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
  dependencies: DependentBuildableProjectNode[]
) {
  const outputs = getOutputsForTargetAndConfiguration(
    context.target.target,
    context.target.configuration,
    node
  );

  const packageJsonPath = `${outputs[0]}/package.json`;
  let packageJson;
  try {
    packageJson = readJsonFile(packageJsonPath);
  } catch (e) {
    // cannot find or invalid package.json
    return;
  }

  packageJson.dependencies = packageJson.dependencies || {};

  let updatePackageJson = false;
  dependencies.forEach(entry => {
    if (
      !hasDependency(packageJson, 'dependencies', entry.name) &&
      !hasDependency(packageJson, 'devDependencies', entry.name) &&
      !hasDependency(packageJson, 'peerDependencies', entry.name)
    ) {
      try {
        const outputs = getOutputsForTargetAndConfiguration(
          context.target.target,
          context.target.configuration,
          entry.node
        );
        const depPackageJsonPath = join(
          context.workspaceRoot,
          outputs[0],
          'package.json'
        );
        const depPackageJson = readJsonFile(depPackageJsonPath);

        packageJson.dependencies[entry.name] = depPackageJson.version;
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

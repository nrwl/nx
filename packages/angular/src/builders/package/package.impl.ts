import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import * as ng from '@angular/compiler-cli';
import { readJsonFile, output } from '@nrwl/workspace';
import {
  createProjectGraph,
  ProjectGraphNode,
  ProjectType
} from '@nrwl/workspace/src/core/project-graph';
import { fileExists, writeJsonFile } from '@nrwl/workspace/src/utils/fileutils';
import { join, resolve } from 'path';
import { from, Observable, of } from 'rxjs';
import { map, mapTo, switchMap, tap } from 'rxjs/operators';

export interface BuildAngularLibraryBuilderOptions {
  /**
   * The file path for the ng-packagr configuration file, relative to the current workspace.
   */
  project: string;
  /**
   * The full path for the TypeScript configuration file, relative to the current workspace.
   */
  tsConfig?: string;
  /**
   * Run build when files change.
   */
  watch?: boolean;
}

type DependentLibraryNode = {
  scope: string;
  outputPath: string;
  node: ProjectGraphNode;
};

/**
 * It is a prerequisite that dependent libraries have been built before the parent
 * library. This function checks that
 * @param context
 */
function checkDependentLibrariesHaveBeenBuilt(
  context: BuilderContext,
  projectDependencies: DependentLibraryNode[]
) {
  const depLibsToBuildFirst: DependentLibraryNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach(libDep => {
    // check wether dependent library has been built => that's necessary
    const packageJsonPath = join(
      context.workspaceRoot,
      'dist',
      libDep.node.data.root,
      'package.json'
    );

    if (!fileExists(packageJsonPath)) {
      depLibsToBuildFirst.push(libDep);
    }
  });

  if (depLibsToBuildFirst.length > 0) {
    context.logger.error(stripIndents`
      Some of the library ${
        context.target.project
      }'s dependencies have not been built yet. Please build these libraries before:
      ${depLibsToBuildFirst.map(x => ` - ${x.node.name}`).join('\n')}

      Try: nx run-many --target build --projects ${context.target.project},...
    `);

    return { success: false };
  } else {
    return { success: true };
  }
}

async function initializeNgPackagr(
  options: BuildAngularLibraryBuilderOptions & JsonObject,
  context: BuilderContext,
  projectDependencies: DependentLibraryNode[]
): Promise<import('ng-packagr').NgPackagr> {
  const packager = (await import('ng-packagr')).ngPackagr();
  packager.forProject(resolve(context.workspaceRoot, options.project));

  if (options.tsConfig) {
    // read the tsconfig and modify its path in memory to
    // pass it on to ngpackagr
    const parsedTSConfig = ng.readConfiguration(options.tsConfig);

    // update the tsconfig.lib.json => we only do this in memory
    // and pass it along to ng-packagr
    projectDependencies.forEach(libDep => {
      parsedTSConfig.options.paths[libDep.scope] = [
        libDep.outputPath,
        ...parsedTSConfig.options.paths[libDep.scope]
      ];
    });

    packager.withTsConfig(parsedTSConfig);
  }

  return packager;
}

/**
 * Given a target library, uses the project dep graph to find all its dependencies
 * and calculates the `scope` name and output path
 * @param targetProj the target library to build
 */
export function calculateLibraryDependencies(
  context: BuilderContext
): DependentLibraryNode[] {
  const targetProj = context.target.project;
  const projGraph = createProjectGraph();

  const hasArchitectBuildBuilder = (projectGraph: ProjectGraphNode): boolean =>
    projectGraph.data.architect &&
    projectGraph.data.architect.build &&
    projectGraph.data.architect.build.builder !== '';

  // gather the library dependencies
  return (projGraph.dependencies[targetProj] || [])
    .map(dependency => {
      const depNode = projGraph.nodes[dependency.target];

      if (
        depNode.type === ProjectType.lib &&
        hasArchitectBuildBuilder(depNode)
      ) {
        const libPackageJson = readJsonFile(
          join(context.workspaceRoot, depNode.data.root, 'package.json')
        );

        return {
          scope: libPackageJson.name, // i.e. @wrkspace/mylib
          outputPath: `dist/${depNode.data.root}`,
          node: depNode
        };
      } else {
        return null;
      }
    })
    .filter(x => !!x);
}

// verify whether the package.json already specifies the dep
function hasDependency(outputJson, depConfigName: string, packageName: string) {
  if (outputJson[depConfigName]) {
    return outputJson[depConfigName][packageName];
  } else {
    return false;
  }
}

/**
 * Updates the peerDependencies section in the `dist/lib/xyz/package.json` with
 * the proper dependency and version
 */
function updatePackageJsonDependencies(
  context: BuilderContext,
  libDependencies: DependentLibraryNode[]
) {
  const targetProject = context.target.project;

  const projGraph = createProjectGraph();
  const targetProjNode = projGraph.nodes[targetProject];

  let distLibOutputPath = `dist/${targetProjNode.data.root}`;

  // if we have dependencies, update the `dependencies` section of the package.json
  const jsonOutputFile = `${distLibOutputPath}/package.json`;
  if (libDependencies && libDependencies.length > 0) {
    const outputJson = readJsonFile(jsonOutputFile);
    let writeJson = false;

    outputJson.dependencies = outputJson.dependencies || {};

    libDependencies.forEach(entry => {
      if (
        !hasDependency(outputJson, 'dependencies', entry.scope) &&
        !hasDependency(outputJson, 'devDependencies', entry.scope) &&
        !hasDependency(outputJson, 'peerDependencies', entry.scope)
      ) {
        // read the lib version (should we read the one from the dist?)
        const packageJsonPath = join(
          context.workspaceRoot,
          entry.node.data.root,
          'package.json'
        );
        const depNodePackageJson = readJsonFile(packageJsonPath);

        outputJson.dependencies[entry.scope] = depNodePackageJson.version;
        writeJson = true;
      }
    });

    if (writeJson) {
      writeJsonFile(jsonOutputFile, outputJson);
    }
  }
}

export function run(
  options: BuildAngularLibraryBuilderOptions & JsonObject,
  context: BuilderContext
): Observable<BuilderOutput> {
  const dependencies = calculateLibraryDependencies(context);

  return of(checkDependentLibrariesHaveBeenBuilt(context, dependencies)).pipe(
    switchMap(result => {
      if (result.success) {
        return from(initializeNgPackagr(options, context, dependencies)).pipe(
          switchMap(packager =>
            options.watch ? packager.watch() : packager.build()
          ),
          tap(() => {
            updatePackageJsonDependencies(context, dependencies);
          }),
          mapTo({ success: true })
        );
      } else {
        // just pass on the result
        return of(result);
      }
    })
  );
}

export default createBuilder<Record<string, string> & any>(run);

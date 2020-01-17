import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { readJsonFile, readTsConfig, deleteFile } from '@nrwl/workspace';
import { writeJsonFile, fileExists } from '@nrwl/workspace/src/utils/fileutils';
import { ChildProcess, fork } from 'child_process';
import { copy, removeSync } from 'fs-extra';
import * as glob from 'glob';
import { basename, dirname, join, normalize, relative } from 'path';
import { Observable, Subscriber, from, of } from 'rxjs';
import { switchMap, tap, map, finalize } from 'rxjs/operators';
import * as treeKill from 'tree-kill';
import {
  ProjectGraphNode,
  ProjectType,
  createProjectGraph
} from '@nrwl/workspace/src/core/project-graph';
import * as ts from 'typescript';
import { unlinkSync } from 'fs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export interface NodePackageBuilderOptions extends JsonObject {
  main: string;
  tsConfig: string;
  outputPath: string;
  watch: boolean;
  sourceMap: boolean;
  assets: Array<AssetGlob | string>;
  packageJson: string;
}

interface NormalizedBuilderOptions extends NodePackageBuilderOptions {
  files: Array<FileInputOutput>;
  normalizedOutputPath: string;
  relativeMainFileOutput: string;
}

type FileInputOutput = {
  input: string;
  output: string;
};
type AssetGlob = FileInputOutput & {
  glob: string;
  ignore: string[];
};

/**
 * -----------------------------------------------------------
 */

type DependentLibraryNode = {
  scope: string;
  outputPath: string;
  node: ProjectGraphNode;
};

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
          outputPath:
            (depNode.data.architect &&
              depNode.data.architect.build &&
              depNode.data.architect.build.options &&
              depNode.data.architect.build.options.outputPath) ||
            `dist/${depNode.data.root}`,
          node: depNode
        };
      } else {
        return null;
      }
    })
    .filter(x => !!x);
}

function checkDependentLibrariesHaveBeenBuilt(
  context: BuilderContext,
  projectDependencies: DependentLibraryNode[]
) {
  const depLibsToBuildFirst: DependentLibraryNode[] = [];

  // verify whether all dependent libraries have been built
  projectDependencies.forEach(libDep => {
    // check wether dependent library has been built => that's necessary
    const normalizedOptions = normalizeOptions(
      libDep.node.data.architect.build.options,
      context
    );

    const packageJsonPath = join(normalizedOptions.outputPath, 'package.json');

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

export default createBuilder(runNodePackageBuilder);

export function runNodePackageBuilder(
  options: NodePackageBuilderOptions,
  context: BuilderContext
) {
  const normalizedOptions = normalizeOptions(options, context);
  const libDependencies = calculateLibraryDependencies(context);

  return of(
    checkDependentLibrariesHaveBeenBuilt(context, libDependencies)
  ).pipe(
    switchMap(result => {
      if (result.success) {
        return compileTypeScriptFiles(
          normalizedOptions,
          context,
          libDependencies
        ).pipe(
          tap(() => {
            updatePackageJson(normalizedOptions, context, libDependencies);
          }),
          switchMap(() => {
            return copyAssetFiles(normalizedOptions, context);
          })
        );
      } else {
        return of(result);
      }
    }),
    map(value => {
      return {
        ...value,
        outputPath: normalizedOptions.outputPath
      };
    })
  );
}

function normalizeOptions(
  options: NodePackageBuilderOptions,
  context: BuilderContext
) {
  const outDir = options.outputPath;
  const files: FileInputOutput[] = [];

  const globbedFiles = (
    pattern: string,
    input: string = '',
    ignore: string[] = []
  ) => {
    return glob.sync(pattern, {
      cwd: input,
      ignore: ignore
    });
  };

  options.assets.forEach(asset => {
    if (typeof asset === 'string') {
      globbedFiles(asset, context.workspaceRoot).forEach(globbedFile => {
        files.push({
          input: join(context.workspaceRoot, globbedFile),
          output: join(context.workspaceRoot, outDir, basename(globbedFile))
        });
      });
    } else {
      globbedFiles(
        asset.glob,
        join(context.workspaceRoot, asset.input),
        asset.ignore
      ).forEach(globbedFile => {
        files.push({
          input: join(context.workspaceRoot, asset.input, globbedFile),
          output: join(context.workspaceRoot, outDir, asset.output, globbedFile)
        });
      });
    }
  });

  // Relative path for the dist directory
  const tsconfig = readJsonFile(join(context.workspaceRoot, options.tsConfig));
  const rootDir = tsconfig.compilerOptions.rootDir || '';
  const mainFileDir = dirname(options.main);
  const tsconfigDir = dirname(options.tsConfig);

  const relativeMainFileOutput = relative(
    `${tsconfigDir}/${rootDir}`,
    mainFileDir
  );

  return {
    ...options,
    files,
    relativeMainFileOutput,
    normalizedOutputPath: join(context.workspaceRoot, options.outputPath)
  };
}

let tscProcess: ChildProcess;
function compileTypeScriptFiles(
  options: NormalizedBuilderOptions,
  context: BuilderContext,
  projectDependencies: DependentLibraryNode[]
): Observable<BuilderOutput> {
  if (tscProcess) {
    killProcess(context);
  }
  // Cleaning the /dist folder
  removeSync(options.normalizedOutputPath);
  let tsConfigPath = join(context.workspaceRoot, options.tsConfig);

  return Observable.create((subscriber: Subscriber<BuilderOutput>) => {
    if (projectDependencies.length > 0) {
      // const parsedTSConfig = readTsConfig(tsConfigPath);
      const parsedTSConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
        .config;

      // update TSConfig paths to point to the dist folder
      projectDependencies.forEach(libDep => {
        parsedTSConfig.compilerOptions = parsedTSConfig.compilerOptions || {};
        parsedTSConfig.compilerOptions.paths =
          parsedTSConfig.compilerOptions.paths || {};

        const currentPaths =
          parsedTSConfig.compilerOptions.paths[libDep.scope] || [];
        parsedTSConfig.compilerOptions.paths[libDep.scope] = [
          libDep.outputPath,
          ...currentPaths
        ];
      });

      // find the library root folder
      const projGraph = createProjectGraph();
      const libRoot = projGraph.nodes[context.target.project].data.root;

      // write the tmp tsconfig needed for building
      const tmpTsConfigPath = join(
        context.workspaceRoot,
        libRoot,
        'tsconfig.lib.nx-tmp'
      );
      writeJsonFile(tmpTsConfigPath, parsedTSConfig);

      // adjust the tsConfig path s.t. it points to the temporary one
      // with the adjusted paths
      tsConfigPath = tmpTsConfigPath;
    }

    try {
      let args = ['-p', tsConfigPath, '--outDir', options.normalizedOutputPath];

      if (options.sourceMap) {
        args.push('--sourceMap');
      }

      const tscPath = join(
        context.workspaceRoot,
        '/node_modules/typescript/bin/tsc'
      );
      if (options.watch) {
        context.logger.info('Starting TypeScript watch');
        args.push('--watch');
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        subscriber.next({ success: true });
      } else {
        context.logger.info(
          `Compiling TypeScript files for library ${context.target.project}...`
        );
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        tscProcess.on('exit', code => {
          if (code === 0) {
            context.logger.info(
              `Done compiling TypeScript files for library ${context.target.project}`
            );
            subscriber.next({ success: true });
          } else {
            subscriber.error('Could not compile Typescript files');
          }
          subscriber.complete();
        });
      }
    } catch (error) {
      if (tscProcess) {
        killProcess(context);
      }
      subscriber.error(
        new Error(`Could not compile Typescript files: \n ${error}`)
      );
    }
  }).pipe(
    finalize(() => {
      cleanupTmpTsConfigFile(tsConfigPath);
    })
  );
}

function cleanupTmpTsConfigFile(tsConfigPath) {
  if (tsConfigPath.indexOf('.nx-tmp') > -1) {
    unlinkSync(tsConfigPath);
  }
}

function killProcess(context: BuilderContext): void {
  return treeKill(tscProcess.pid, 'SIGTERM', error => {
    tscProcess = null;
    if (error) {
      if (Array.isArray(error) && error[0] && error[2]) {
        const errorMessage = error[2];
        context.logger.error(errorMessage);
      } else if (error.message) {
        context.logger.error(error.message);
      }
    }
  });
}

// verify whether the package.json already specifies the dep
function hasDependency(outputJson, depConfigName: string, packageName: string) {
  if (outputJson[depConfigName]) {
    return outputJson[depConfigName][packageName];
  } else {
    return false;
  }
}

function updatePackageJson(
  options: NormalizedBuilderOptions,
  context: BuilderContext,
  libDependencies: DependentLibraryNode[]
) {
  const mainFile = basename(options.main, '.ts');
  const typingsFile = `${mainFile}.d.ts`;
  const mainJsFile = `${mainFile}.js`;
  const packageJson = readJsonFile(
    join(context.workspaceRoot, options.packageJson)
  );

  packageJson.main = normalize(
    `./${options.relativeMainFileOutput}/${mainJsFile}`
  );
  packageJson.typings = normalize(
    `./${options.relativeMainFileOutput}/${typingsFile}`
  );

  // add any dependency to the dependencies section
  packageJson.dependencies = packageJson.dependencies || {};
  libDependencies.forEach(entry => {
    if (
      !hasDependency(packageJson, 'dependencies', entry.scope) &&
      !hasDependency(packageJson, 'devDependencies', entry.scope) &&
      !hasDependency(packageJson, 'peerDependencies', entry.scope)
    ) {
      // read the lib version (should we read the one from the dist?)
      const packageJsonPath = join(
        context.workspaceRoot,
        entry.node.data.root,
        'package.json'
      );
      const depNodePackageJson = readJsonFile(packageJsonPath);

      packageJson.dependencies[entry.scope] = depNodePackageJson.version;
    }
  });

  // avoid adding empty dependencies
  if (Object.keys(packageJson.dependencies).length === 0) {
    delete packageJson.dependencies;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}

function copyAssetFiles(
  options: NormalizedBuilderOptions,
  context: BuilderContext
): Promise<BuilderOutput> {
  context.logger.info('Copying asset files...');
  return Promise.all(options.files.map(file => copy(file.input, file.output)))
    .then(() => {
      context.logger.info('Done copying asset files.');
      return {
        success: true
      };
    })
    .catch(err => {
      return {
        success: false
      };
    });
}

import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { readJsonFile } from '@nrwl/workspace';
import { writeJsonFile } from '@nrwl/workspace/src/utils/fileutils';
import { ChildProcess, fork } from 'child_process';
import { copy, removeSync } from 'fs-extra';
import * as glob from 'glob';
import { basename, dirname, join, normalize, relative } from 'path';
import { Observable, Subscriber } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';
import * as treeKill from 'tree-kill';

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

export default createBuilder(runNodePackageBuilder);

export function runNodePackageBuilder(
  options: NodePackageBuilderOptions,
  context: BuilderContext
) {
  const normalizedOptions = normalizeOptions(options, context);
  return compileTypeScriptFiles(normalizedOptions, context).pipe(
    tap(() => {
      updatePackageJson(normalizedOptions, context);
    }),
    switchMap(() => {
      return copyAssetFiles(normalizedOptions, context);
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
  context: BuilderContext
): Observable<BuilderOutput> {
  if (tscProcess) {
    killProcess(context);
  }
  // Cleaning the /dist folder
  removeSync(options.normalizedOutputPath);

  return Observable.create((subscriber: Subscriber<BuilderOutput>) => {
    try {
      let args = [
        '-p',
        join(context.workspaceRoot, options.tsConfig),
        '--outDir',
        options.normalizedOutputPath
      ];

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
        context.logger.info('Compiling TypeScript files...');
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        tscProcess.on('exit', code => {
          if (code === 0) {
            context.logger.info('Done compiling TypeScript files.');
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
  });
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

function updatePackageJson(
  options: NormalizedBuilderOptions,
  context: BuilderContext
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

import { relative } from 'path';
import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { from, Observable, of } from 'rxjs';
import { map, mergeScan, switchMap, tap } from 'rxjs/operators';
import { runRollup } from './run-rollup';
import { createBabelConfig as _createBabelConfig } from '../../utils/babel-config';
import * as autoprefixer from 'autoprefixer';
import * as rollup from 'rollup';
import * as babel from 'rollup-plugin-babel';
import * as peerDepsExternal from 'rollup-plugin-peer-deps-external';
import * as postcss from 'rollup-plugin-postcss';
import * as filesize from 'rollup-plugin-filesize';
import * as localResolve from 'rollup-plugin-local-resolve';
import { BundleBuilderOptions } from '../../utils/types';
import { normalizeBundleOptions } from '../../utils/normalize';
import { toClassName } from '@nrwl/workspace/src/utils/name-utils';
import { BuildResult } from '@angular-devkit/build-webpack';
import {
  readJsonFile,
  writeJsonFile
} from '@nrwl/workspace/src/utils/fileutils';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  updateBuildableProjectPackageJsonDependencies,
  updatePaths
} from '@nrwl/workspace/src/utils/buildale-libs-utils';
import * as ts from 'typescript';

// These use require because the ES import isn't correct.
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const typescript = require('rollup-plugin-typescript2');

export default createBuilder<BundleBuilderOptions & JsonObject>(run);

interface OutputConfig {
  format: rollup.ModuleFormat;
  esm: boolean;
  extension: string;
  declaration?: boolean;
}

const outputConfigs: OutputConfig[] = [
  { format: 'umd', esm: false, extension: 'umd' },
  { format: 'esm', esm: true, extension: 'esm2015' },
  { format: 'esm', esm: false, extension: 'esm5' }
];

const fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export function run(
  _options: BundleBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const projGraph = createProjectGraph();
  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context
  );

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap(result => {
      if (!result) {
        return of({ success: false });
      }
      const options = normalizeBundleOptions(_options, context.workspaceRoot);
      const rollupOptions: rollup.InputOptions[] = outputConfigs.map(
        ({ format, esm, extension }) => {
          const parsedTSConfig = ts.readConfigFile(
            options.tsConfig,
            ts.sys.readFile
          ).config;
          parsedTSConfig.compilerOptions = parsedTSConfig.compilerOptions || {};
          parsedTSConfig.compilerOptions.paths =
            parsedTSConfig.compilerOptions.paths || {};
          updatePaths(dependencies, parsedTSConfig.compilerOptions.paths);

          const plugins = [
            peerDepsExternal({
              packageJsonPath: options.project
            }),
            postcss({
              inject: true,
              extract: false,
              autoModules: true,
              plugins: [autoprefixer]
            }),
            localResolve(),
            resolve({ extensions: fileExtensions }),
            babel({
              ...createBabelConfig(options, options.projectRoot, esm),
              extensions: fileExtensions,
              externalHelpers: false,
              exclude: 'node_modules/**'
            }),
            commonjs(),
            filesize()
          ];
          if (esm) {
            // TS plugin has to come first before types are stripped, otherwise
            plugins.unshift(
              typescript({
                check: true,
                tsconfig: options.tsConfig,
                tsconfigOverride: {
                  compilerOptions: {
                    rootDir: options.entryRoot,
                    allowJs: false,
                    declaration: true,
                    paths: parsedTSConfig.compilerOptions.paths
                  }
                }
              })
            );
          }
          const entryFileTmpl = `${options.outputPath}/${context.target.project}.<%= extension %>.js`;
          const rollupConfig = {
            input: options.entryFile,
            output: {
              format,
              file: entryFileTmpl.replace('<%= extension %>', extension),
              name: toClassName(context.target.project)
            },
            external: dependencies.map(d => d.name),
            plugins
          };
          return options.rollupConfig
            ? require(options.rollupConfig)(rollupConfig)
            : rollupConfig;
        }
      );

      if (options.watch) {
        return new Observable<BuildResult>(obs => {
          const watcher = rollup.watch(rollupOptions);
          watcher.on('event', ({ code, error }) => {
            if (code === 'START') {
              context.logger.info('Bundling...');
            } else if (code === 'END') {
              updatePackageJson(options, context, target, dependencies);
              context.logger.info(
                'Bundle complete. Watching for file changes...'
              );
              obs.next({ success: true });
            } else if (code === 'ERROR') {
              context.logger.error(`Error during bundle: ${error.message}`);
              obs.next({ success: false });
            } else if (code === 'FATAL') {
              // Cannot continue, stop the observable.
              context.logger.error(
                `Fatal error during bundle: ${error.message}`
              );
              obs.complete();
            }
          });
          // Teardown logic. Close watcher when unsubscribed.
          return () => watcher.close();
        });
      } else {
        context.logger.info('Bundling...');
        return from(rollupOptions).pipe(
          mergeScan(
            (acc, options) =>
              runRollup(options).pipe(
                map(result => {
                  return {
                    success: acc.success && result.success
                  };
                })
              ),
            { success: true }
          ),
          tap({
            complete: () => {
              updatePackageJson(options, context, target, dependencies);
              context.logger.info('Bundle complete.');
            }
          })
        );
      }
    })
  );
}

// -----------------------------------------------------------------------------

function createBabelConfig(
  options: BundleBuilderOptions,
  projectRoot: string,
  esm: boolean
) {
  let babelConfig: any = _createBabelConfig(projectRoot, esm, false);
  if (options.babelConfig) {
    babelConfig = require(options.babelConfig)(babelConfig, options);
  }
  // Ensure async functions are transformed to promises properly.
  upsert(
    'plugins',
    'babel-plugin-transform-async-to-promises',
    null,
    babelConfig
  );
  upsert(
    'plugins',
    '@babel/plugin-transform-regenerator',
    { async: false },
    babelConfig
  );
  return babelConfig;
}

function upsert(
  type: 'presets' | 'plugins',
  pluginOrPreset: string,
  opts: null | JsonObject,
  config: any
) {
  if (
    !config[type].some(
      p =>
        (Array.isArray(p) && p[0].indexOf(pluginOrPreset) !== -1) ||
        p.indexOf(pluginOrPreset) !== -1
    )
  ) {
    const fullPath = require.resolve(pluginOrPreset);
    config[type] = config[type].concat([opts ? [fullPath, opts] : fullPath]);
  }
}

function updatePackageJson(options, context, target, dependencies) {
  const entryFileTmpl = `./${context.target.project}.<%= extension %>.js`;
  const typingsFile = relative(options.entryRoot, options.entryFile).replace(
    /\.[jt]sx?$/,
    '.d.ts'
  );
  const packageJson = readJsonFile(options.project);
  packageJson.main = entryFileTmpl.replace('<%= extension %>', 'umd');
  packageJson.module = entryFileTmpl.replace('<%= extension %>', 'esm5');
  packageJson.es2015 = entryFileTmpl.replace('<%= extension %>', 'esm2015');
  packageJson.typings = `./${typingsFile}`;
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);

  if (dependencies.length > 0) {
    updateBuildableProjectPackageJsonDependencies(
      context,
      target,
      dependencies
    );
  }
}

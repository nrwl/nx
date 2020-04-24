import { relative } from 'path';
import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { Observable, of } from 'rxjs';
import { catchError, last, switchMap, tap } from 'rxjs/operators';
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
import {
  normalizeBundleOptions,
  NormalizedBundleBuilderOptions
} from '../../utils/normalize';
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
  DependentBuildableProjectNode,
  computeCompilerOptionsPaths,
  updateBuildableProjectPackageJsonDependencies
} from '@nrwl/workspace/src/utils/buildable-libs-utils';

// These use require because the ES import isn't correct.
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('rollup-plugin-typescript2');
const image = require('@rollup/plugin-image');

export default createBuilder<BundleBuilderOptions & JsonObject>(run);

interface OutputConfig {
  format: rollup.ModuleFormat;
  extension: string;
  declaration?: boolean;
}

const outputConfigs: OutputConfig[] = [
  { format: 'umd', extension: 'umd' },
  { format: 'esm', extension: 'esm' }
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
      const packageJson = readJsonFile(options.project);
      const rollupOptions = createRollupOptions(
        options,
        dependencies,
        context,
        packageJson
      );

      if (options.watch) {
        return new Observable<BuildResult>(obs => {
          const watcher = rollup.watch([rollupOptions]);
          watcher.on('event', data => {
            if (data.code === 'START') {
              context.logger.info('Bundling...');
            } else if (data.code === 'END') {
              updatePackageJson(
                options,
                context,
                target,
                dependencies,
                packageJson
              );
              context.logger.info(
                'Bundle complete. Watching for file changes...'
              );
              obs.next({ success: true });
            } else if (data.code === 'ERROR') {
              context.logger.error(
                `Error during bundle: ${data.error.message}`
              );
              obs.next({ success: false });
            }
          });
          // Teardown logic. Close watcher when unsubscribed.
          return () => watcher.close();
        });
      } else {
        context.logger.info('Bundling...');
        return runRollup(rollupOptions).pipe(
          catchError(e => {
            context.logger.error(`Error during bundle: ${e}`);
            return of({ success: false });
          }),
          last(),
          tap({
            next: result => {
              if (result.success) {
                updatePackageJson(
                  options,
                  context,
                  target,
                  dependencies,
                  packageJson
                );
                context.logger.info('Bundle complete.');
              } else {
                context.logger.error('Bundle failed.');
              }
            }
          })
        );
      }
    })
  );
}

// -----------------------------------------------------------------------------

function createRollupOptions(
  options: NormalizedBundleBuilderOptions,
  dependencies: DependentBuildableProjectNode[],
  context: BuilderContext,
  packageJson: any
): rollup.InputOptions {
  const compilerOptionPaths = computeCompilerOptionsPaths(
    options.tsConfig,
    dependencies
  );

  const plugins = [
    image(),
    typescript({
      check: true,
      tsconfig: options.tsConfig,
      tsconfigOverride: {
        compilerOptions: {
          rootDir: options.entryRoot,
          allowJs: false,
          declaration: true,
          paths: compilerOptionPaths
        }
      }
    }),
    peerDepsExternal({
      packageJsonPath: options.project
    }),
    postcss({
      inject: true,
      extract: options.extractCss,
      autoModules: true,
      plugins: [autoprefixer]
    }),
    localResolve(),
    resolve({
      preferBuiltins: true,
      extensions: fileExtensions
    }),
    babel({
      ...createBabelConfig(options, options.projectRoot),
      extensions: fileExtensions,
      externalHelpers: false,
      exclude: 'node_modules/**'
    }),
    commonjs(),
    filesize()
  ];

  const globals = options.globals
    ? options.globals.reduce((acc, item) => {
        acc[item.moduleId] = item.global;
        return acc;
      }, {})
    : {};

  const externalPackages = dependencies
    .map(d => d.name)
    .concat(options.external || [])
    .concat(Object.keys(packageJson.dependencies || {}));

  const rollupConfig = {
    input: options.entryFile,
    output: outputConfigs.map(o => {
      return {
        globals,
        format: o.format,
        file: `${options.outputPath}/${context.target.project}.${o.extension}.js`,
        name: toClassName(context.target.project)
      };
    }),
    external: id => externalPackages.includes(id),
    plugins
  };

  return options.rollupConfig
    ? require(options.rollupConfig)(rollupConfig)
    : rollupConfig;
}

function createBabelConfig(options: BundleBuilderOptions, projectRoot: string) {
  let babelConfig: any = _createBabelConfig(projectRoot, false, false);
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

function updatePackageJson(
  options,
  context,
  target,
  dependencies,
  packageJson
) {
  const entryFileTmpl = `./${context.target.project}.<%= extension %>.js`;
  const typingsFile = relative(options.entryRoot, options.entryFile).replace(
    /\.[jt]sx?$/,
    '.d.ts'
  );
  packageJson.main = entryFileTmpl.replace('<%= extension %>', 'umd');
  packageJson.module = entryFileTmpl.replace('<%= extension %>', 'esm');
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

import { ExecutorContext, logger, names } from '@nrwl/devkit';

import * as rollup from 'rollup';
import * as peerDepsExternal from 'rollup-plugin-peer-deps-external';
import * as localResolve from 'rollup-plugin-local-resolve';
import { getBabelInputPlugin } from '@rollup/plugin-babel';

// These use require because the ES import isn't correct.
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('rollup-plugin-typescript2');
const image = require('@rollup/plugin-image');
const json = require('@rollup/plugin-json');
const copy = require('rollup-plugin-copy');
const postcss = require('rollup-plugin-postcss');
const filesize = require('rollup-plugin-filesize');

import { join, relative } from 'path';
import { from, Observable, of } from 'rxjs';
import { catchError, concatMap, last, tap } from 'rxjs/operators';
import { eachValueFrom } from 'rxjs-for-await';
import * as autoprefixer from 'autoprefixer';

import {
  readJsonFile,
  writeJsonFile,
} from '@nrwl/workspace/src/utilities/fileutils';
import {
  createProjectGraph,
  ProjectGraphNode,
} from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  computeCompilerOptionsPaths,
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';

import { AssetGlobPattern, PackageBuilderOptions } from '../../utils/types';
import {
  NormalizedBundleBuilderOptions,
  normalizePackageOptions,
} from '../../utils/normalize';
import { deleteOutputDir } from '../../utils/delete-output-dir';
import { runRollup } from './run-rollup';

interface OutputConfig {
  format: rollup.ModuleFormat;
  extension: string;
  declaration?: boolean;
}

const outputConfigs: OutputConfig[] = [
  { format: 'umd', extension: 'umd' },
  { format: 'esm', extension: 'esm' },
];

const fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export default function run(
  rawOptions: PackageBuilderOptions,
  context: ExecutorContext
) {
  const project = context.workspace.projects[context.projectName];
  const sourceRoot = project.sourceRoot;
  const projGraph = createProjectGraph();
  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  if (
    !checkDependentProjectsHaveBeenBuilt(
      context.root,
      context.projectName,
      context.targetName,
      dependencies
    )
  ) {
    throw new Error();
  }

  const options = normalizePackageOptions(rawOptions, context.root, sourceRoot);
  const packageJson = readJsonFile(options.project);

  const rollupOptions = createRollupOptions(
    options,
    dependencies,
    context,
    packageJson,
    sourceRoot
  );

  if (options.watch) {
    const watcher = rollup.watch(rollupOptions);
    return eachValueFrom(
      new Observable<{ success: boolean }>((obs) => {
        watcher.on('event', (data) => {
          if (data.code === 'START') {
            logger.info(`Bundling ${context.projectName}...`);
          } else if (data.code === 'END') {
            updatePackageJson(
              options,
              context,
              target,
              dependencies,
              packageJson
            );
            logger.info('Bundle complete. Watching for file changes...');
            obs.next({ success: true });
          } else if (data.code === 'ERROR') {
            logger.error(`Error during bundle: ${data.error.message}`);
            obs.next({ success: false });
          }
        });
        // Teardown logic. Close watcher when unsubscribed.
        return () => watcher.close();
      })
    );
  } else {
    logger.info(`Bundling ${context.projectName}...`);

    // Delete output path before bundling
    if (options.deleteOutputPath) {
      deleteOutputDir(context.root, options.outputPath);
    }

    return from(rollupOptions)
      .pipe(
        concatMap((opts) =>
          runRollup(opts).pipe(
            catchError((e) => {
              logger.error(`Error during bundle: ${e}`);
              return of({ success: false });
            }),
            last(),
            tap({
              next: (result) => {
                if (result.success) {
                  updatePackageJson(
                    options,
                    context,
                    target,
                    dependencies,
                    packageJson
                  );
                  logger.info(`Bundle complete: ${context.projectName}`);
                } else {
                  logger.error(`Bundle failed: ${context.projectName}`);
                }
              },
            })
          )
        )
      )
      .toPromise();
  }
}

// -----------------------------------------------------------------------------

export function createRollupOptions(
  options: NormalizedBundleBuilderOptions,
  dependencies: DependentBuildableProjectNode[],
  context: ExecutorContext,
  packageJson: any,
  sourceRoot: string
): rollup.InputOptions[] {
  return outputConfigs.map((config) => {
    const compilerOptionPaths = computeCompilerOptionsPaths(
      options.tsConfig,
      dependencies
    );

    const plugins = [
      copy({
        targets: convertCopyAssetsToRollupOptions(
          options.outputPath,
          options.assets
        ),
      }),
      image(),
      typescript({
        check: true,
        tsconfig: options.tsConfig,
        tsconfigOverride: {
          compilerOptions: {
            rootDir: options.entryRoot,
            allowJs: false,
            declaration: true,
            paths: compilerOptionPaths,
            target: config.format === 'esm' ? undefined : 'es5',
          },
        },
      }),
      peerDepsExternal({
        packageJsonPath: options.project,
      }),
      postcss({
        inject: true,
        extract: options.extractCss,
        autoModules: true,
        plugins: [autoprefixer],
      }),
      localResolve(),
      resolve({
        preferBuiltins: true,
        extensions: fileExtensions,
      }),
      getBabelInputPlugin({
        cwd: join(context.root, sourceRoot),
        rootMode: 'upward',
        babelrc: true,
        extensions: fileExtensions,
        babelHelpers: 'bundled',
        exclude: /node_modules/,
        plugins: [
          config.format === 'esm'
            ? undefined
            : require.resolve('babel-plugin-transform-async-to-promises'),
        ].filter(Boolean),
      }),
      commonjs(),
      filesize(),
      json(),
    ];

    const globals = options.globals
      ? options.globals.reduce((acc, item) => {
          acc[item.moduleId] = item.global;
          return acc;
        }, {})
      : {};

    const externalPackages = dependencies
      .map((d) => d.name)
      .concat(options.external || [])
      .concat(Object.keys(packageJson.dependencies || {}));

    const rollupConfig = {
      input: options.entryFile,
      output: {
        globals,
        format: config.format,
        file: `${options.outputPath}/${context.projectName}.${config.extension}.js`,
        name: options.umdName || names(context.projectName).className,
      },
      external: (id) => externalPackages.includes(id),
      plugins,
    };

    return options.rollupConfig
      ? require(options.rollupConfig)(rollupConfig, options)
      : rollupConfig;
  });
}

function updatePackageJson(
  options: NormalizedBundleBuilderOptions,
  context: ExecutorContext,
  target: ProjectGraphNode,
  dependencies: DependentBuildableProjectNode[],
  packageJson: any
) {
  const entryFileTmpl = `./${context.projectName}.<%= extension %>.js`;
  const typingsFile = relative(options.entryRoot, options.entryFile).replace(
    /\.[jt]sx?$/,
    '.d.ts'
  );
  packageJson.main = entryFileTmpl.replace('<%= extension %>', 'umd');
  packageJson.module = entryFileTmpl.replace('<%= extension %>', 'esm');
  packageJson.typings = `./${typingsFile}`;
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);

  if (
    dependencies.length > 0 &&
    options.updateBuildableProjectDepsInPackageJson
  ) {
    updateBuildableProjectPackageJsonDependencies(
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName,
      target,
      dependencies,
      options.buildableProjectDepsInPackageJsonType
    );
  }
}

interface RollupCopyAssetOption {
  src: string;
  dest: string;
}

function convertCopyAssetsToRollupOptions(
  outputPath: string,
  assets: AssetGlobPattern[]
): RollupCopyAssetOption[] {
  return assets
    ? assets.map((a) => ({
        src: join(a.input, a.glob).replace(/\\/g, '/'),
        dest: join(outputPath, a.output).replace(/\\/g, '/'),
      }))
    : undefined;
}

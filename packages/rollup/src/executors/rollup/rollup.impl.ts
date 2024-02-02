import * as ts from 'typescript';
import * as rollup from 'rollup';
import * as peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { getBabelInputPlugin } from '@rollup/plugin-babel';
import { dirname, join, parse, resolve } from 'path';
import { from, Observable, of } from 'rxjs';
import { catchError, concatMap, last, scan, tap } from 'rxjs/operators';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import * as autoprefixer from 'autoprefixer';
import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments, logger, names, readJsonFile } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
  computeCompilerOptionsPaths,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import nodeResolve from '@rollup/plugin-node-resolve';
import type { PackageJson } from 'nx/src/utils/package-json';
import { typeDefinitions } from '@nx/js/src/plugins/rollup/type-definitions';

import { AssetGlobPattern, RollupExecutorOptions } from './schema';
import { runRollup } from './lib/run-rollup';
import {
  NormalizedRollupExecutorOptions,
  normalizeRollupExecutorOptions,
} from './lib/normalize';
import { analyze } from './lib/analyze-plugin';
import { deleteOutputDir } from '../../utils/fs';
import { swc } from './lib/swc-plugin';
import { updatePackageJson } from './lib/update-package-json';

export type RollupExecutorEvent = {
  success: boolean;
  outfile?: string;
};

// These use require because the ES import isn't correct.
const commonjs = require('@rollup/plugin-commonjs');
const image = require('@rollup/plugin-image');

const json = require('@rollup/plugin-json');
const copy = require('rollup-plugin-copy');
const postcss = require('rollup-plugin-postcss');

const fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export async function* rollupExecutor(
  rawOptions: RollupExecutorOptions,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= 'production';

  const project = context.projectsConfigurations.projects[context.projectName];
  const sourceRoot = project.sourceRoot;
  const { target, dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
    context.projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName,
    true
  );

  const options = normalizeRollupExecutorOptions(
    rawOptions,
    context,
    sourceRoot
  );

  const packageJson = readJsonFile(options.project);

  const npmDeps = (context.projectGraph.dependencies[context.projectName] ?? [])
    .filter((d) => d.target.startsWith('npm:'))
    .map((d) => d.target.slice(4));

  const rollupOptions = createRollupOptions(
    options,
    dependencies,
    context,
    packageJson,
    sourceRoot,
    npmDeps
  );

  const outfile = resolveOutfile(context, options);

  if (options.watch) {
    const watcher = rollup.watch(rollupOptions);
    return yield* eachValueFrom(
      new Observable<RollupExecutorEvent>((obs) => {
        watcher.on('event', (data) => {
          if (data.code === 'START') {
            logger.info(`Bundling ${context.projectName}...`);
          } else if (data.code === 'END') {
            updatePackageJson(options, packageJson);
            logger.info('Bundle complete. Watching for file changes...');
            obs.next({ success: true, outfile });
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

    const start = process.hrtime.bigint();

    return from(rollupOptions)
      .pipe(
        concatMap((opts) =>
          runRollup(opts).pipe(
            catchError((e) => {
              logger.error(`Error during bundle: ${e}`);
              return of({ success: false });
            })
          )
        ),
        scan<RollupExecutorEvent, RollupExecutorEvent>(
          (acc, result) => {
            if (!acc.success) return acc;
            return result;
          },
          { success: true, outfile }
        ),
        last(),
        tap({
          next: (result) => {
            if (result.success) {
              const end = process.hrtime.bigint();
              const duration = `${(Number(end - start) / 1_000_000_000).toFixed(
                2
              )}s`;

              updatePackageJson(options, packageJson);
              logger.info(`⚡ Done in ${duration}`);
            } else {
              logger.error(`Bundle failed: ${context.projectName}`);
            }
          },
        })
      )
      .toPromise();
  }
}

// -----------------------------------------------------------------------------

export function createRollupOptions(
  options: NormalizedRollupExecutorOptions,
  dependencies: DependentBuildableProjectNode[],
  context: ExecutorContext,
  packageJson: PackageJson,
  sourceRoot: string,
  npmDeps: string[]
): rollup.InputOptions[] {
  const useBabel = options.compiler === 'babel';
  const useTsc = options.compiler === 'tsc';
  const useSwc = options.compiler === 'swc';

  const tsConfigPath = joinPathFragments(context.root, options.tsConfig);
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(tsConfigPath)
  );

  if (!options.format || !options.format.length) {
    options.format = readCompatibleFormats(config);
  }

  if (packageJson.type === 'module') {
    if (options.format.includes('cjs')) {
      logger.warn(
        `Package type is set to "module" but "cjs" format is included. Going to use "esm" format instead. You can change the package type to "commonjs" or remove type in the package.json file.`
      );
    }
    options.format = ['esm'];
  } else if (packageJson.type === 'commonjs') {
    if (options.format.includes('esm')) {
      logger.warn(
        `Package type is set to "commonjs" but "esm" format is included. Going to use "cjs" format instead. You can change the package type to "module" or remove type in the package.json file.`
      );
    }
    options.format = ['cjs'];
  }

  return options.format.map((format, idx) => {
    // Either we're generating only one format, so we should bundle types
    // OR we are generating dual formats, so only bundle types for CJS.
    const shouldBundleTypes = options.format.length === 1 || format === 'cjs';

    const plugins = [
      copy({
        targets: convertCopyAssetsToRollupOptions(
          options.outputPath,
          options.assets
        ),
      }),
      image(),
      json(),
      (useTsc || shouldBundleTypes) &&
        require('rollup-plugin-typescript2')({
          check: !options.skipTypeCheck,
          tsconfig: options.tsConfig,
          tsconfigOverride: {
            compilerOptions: createTsCompilerOptions(
              config,
              dependencies,
              options
            ),
          },
        }),
      shouldBundleTypes &&
        typeDefinitions({
          main: options.main,
          projectRoot: options.projectRoot,
        }),
      peerDepsExternal({
        packageJsonPath: options.project,
      }),
      postcss({
        inject: true,
        extract: options.extractCss,
        autoModules: true,
        plugins: [autoprefixer],
        use: {
          less: {
            javascriptEnabled: options.javascriptEnabled,
          },
        },
      }),
      nodeResolve({
        preferBuiltins: true,
        extensions: fileExtensions,
      }),
      useSwc && swc(),
      useBabel &&
        getBabelInputPlugin({
          // Lets `@nx/js/babel` preset know that we are packaging.
          caller: {
            // @ts-ignore
            // Ignoring type checks for caller since we have custom attributes
            isNxPackage: true,
            // Always target esnext and let rollup handle cjs
            supportsStaticESM: true,
            isModern: true,
          },
          cwd: join(context.root, sourceRoot),
          rootMode: options.babelUpwardRootMode ? 'upward' : undefined,
          babelrc: true,
          extensions: fileExtensions,
          babelHelpers: 'bundled',
          skipPreflightCheck: true, // pre-flight check may yield false positives and also slows down the build
          exclude: /node_modules/,
          plugins: [
            format === 'esm'
              ? undefined
              : require.resolve('babel-plugin-transform-async-to-promises'),
          ].filter(Boolean),
        }),
      commonjs(),
      analyze(),
    ];

    let externalPackages = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.peerDependencies || {}),
    ]; // If external is set to none, include all dependencies and peerDependencies in externalPackages
    if (options.external === 'all') {
      externalPackages = externalPackages
        .concat(dependencies.map((d) => d.name))
        .concat(npmDeps);
    } else if (Array.isArray(options.external) && options.external.length > 0) {
      externalPackages = externalPackages.concat(options.external);
    }
    externalPackages = [...new Set(externalPackages)];

    const mainEntryFileName = options.outputFileName || options.main;
    const input: Record<string, string> = {};
    input[parse(mainEntryFileName).name] = options.main;
    options.additionalEntryPoints.forEach((entry) => {
      input[parse(entry).name] = entry;
    });

    const rollupConfig = {
      input,
      output: {
        format,
        dir: `${options.outputPath}`,
        name: names(context.projectName).className,
        entryFileNames: `[name].${format}.js`,
        chunkFileNames: `[name].${format}.js`,
      },
      external: (id: string) => {
        return externalPackages.some(
          (name) => id === name || id.startsWith(`${name}/`)
        ); // Could be a deep import
      },
      plugins,
    };

    return options.rollupConfig.reduce((currentConfig, plugin) => {
      return require(plugin)(currentConfig, options);
    }, rollupConfig);
  });
}

function createTsCompilerOptions(
  config: ts.ParsedCommandLine,
  dependencies: DependentBuildableProjectNode[],
  options: NormalizedRollupExecutorOptions
) {
  const compilerOptionPaths = computeCompilerOptionsPaths(config, dependencies);
  const compilerOptions = {
    rootDir: options.projectRoot,
    allowJs: options.allowJs,
    declaration: true,
    paths: compilerOptionPaths,
  };
  if (config.options.module === ts.ModuleKind.CommonJS) {
    compilerOptions['module'] = 'ESNext';
  }
  if (options.compiler === 'swc') {
    compilerOptions['emitDeclarationOnly'] = true;
  }
  return compilerOptions;
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

function readCompatibleFormats(
  config: ts.ParsedCommandLine
): ('cjs' | 'esm')[] {
  switch (config.options.module) {
    case ts.ModuleKind.CommonJS:
    case ts.ModuleKind.UMD:
    case ts.ModuleKind.AMD:
      return ['cjs'];
    default:
      return ['esm'];
  }
}

function resolveOutfile(
  context: ExecutorContext,
  options: NormalizedRollupExecutorOptions
) {
  if (!options.format?.includes('cjs')) return undefined;
  const { name } = parse(options.outputFileName ?? options.main);
  return resolve(context.root, options.outputPath, `${name}.cjs.js`);
}

export default rollupExecutor;

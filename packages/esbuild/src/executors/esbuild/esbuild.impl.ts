import 'dotenv/config';
import * as chalk from 'chalk';
import type { ExecutorContext } from '@nrwl/devkit';
import { cacheDir, joinPathFragments, logger } from '@nrwl/devkit';
import {
  copyAssets,
  copyPackageJson,
  CopyPackageJsonOptions,
  printDiagnostics,
  runTypeCheck as _runTypeCheck,
  TypeCheckOptions,
} from '@nrwl/js';
import * as esbuild from 'esbuild';
import { normalizeOptions } from './lib/normalize';

import { EsBuildExecutorOptions } from './schema';
import { removeSync, writeJsonSync } from 'fs-extra';
import { createAsyncIterable } from '@nrwl/devkit/src/utils/async-iterable';
import { buildEsbuildOptions } from './lib/build-esbuild-options';
import { getExtraDependencies } from './lib/get-extra-dependencies';
import { DependentBuildableProjectNode } from '@nrwl/workspace/src/utilities/buildable-libs-utils';

const CJS_FILE_EXTENSION = '.cjs' as const;

const BUILD_WATCH_FAILED = `[ ${chalk.red(
  'watch'
)} ] build finished with errors (see above), watching for changes...`;
const BUILD_WATCH_SUCCEEDED = `[ ${chalk.green(
  'watch'
)} ] build succeeded, watching for changes...`;

export async function* esbuildExecutor(
  _options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const options = normalizeOptions(_options);
  if (options.deleteOutputPath) removeSync(options.outputPath);

  const assetsResult = await copyAssets(options, context);

  const externalDependencies: DependentBuildableProjectNode[] =
    options.external.map((name) => {
      const externalNode = context.projectGraph.externalNodes[`npm:${name}`];
      if (!externalNode)
        throw new Error(
          `Cannot find external dependency ${name}. Check your package.json file.`
        );
      return {
        name,
        outputs: [],
        node: externalNode,
      };
    });

  if (!options.thirdParty) {
    const thirdPartyDependencies = getExtraDependencies(
      context.projectName,
      context.projectGraph
    );
    for (const tpd of thirdPartyDependencies) {
      options.external.push(tpd.node.data.packageName);
      externalDependencies.push(tpd);
    }
  }

  const cpjOptions: CopyPackageJsonOptions = {
    ...options,
    // TODO(jack): make types generate with esbuild
    skipTypings: true,
    outputFileExtensionForCjs: CJS_FILE_EXTENSION,
    excludeLibsInPackageJson: !options.thirdParty,
    updateBuildableProjectDepsInPackageJson: externalDependencies.length > 0,
  };

  // If we're bundling third-party packages, then any extra deps from external should be the only deps in package.json
  if (options.thirdParty && externalDependencies.length > 0) {
    cpjOptions.overrideDependencies = externalDependencies;
  } else {
    cpjOptions.extraDependencies = externalDependencies;
  }

  const packageJsonResult = await copyPackageJson(cpjOptions, context);

  if (options.watch) {
    return yield* createAsyncIterable<{ success: boolean; outfile?: string }>(
      async ({ next, done }) => {
        let hasTypeErrors = false;

        const results = await Promise.all(
          options.format.map(async (format, idx) => {
            const esbuildOptions = buildEsbuildOptions(
              format,
              options,
              context
            );
            const watch =
              // Only emit info on one of the watch processes.
              idx === 0
                ? {
                    onRebuild: async (
                      error: esbuild.BuildFailure,
                      result: esbuild.BuildResult
                    ) => {
                      if (!options.skipTypeCheck) {
                        const { errors } = await runTypeCheck(options, context);
                        hasTypeErrors = errors.length > 0;
                      }
                      const success = !error && !hasTypeErrors;

                      if (!success) {
                        logger.info(BUILD_WATCH_FAILED);
                      } else {
                        logger.info(BUILD_WATCH_SUCCEEDED);
                      }

                      next({
                        success: !!error && !hasTypeErrors,
                        outfile: esbuildOptions.outfile,
                      });
                    },
                  }
                : true;
            try {
              const result = await esbuild.build({ ...esbuildOptions, watch });

              next({
                success: true,
                outfile: esbuildOptions.outfile,
              });

              return result;
            } catch {
              next({ success: false });
            }
          })
        );
        const processOnExit = () => {
          assetsResult?.stop();
          packageJsonResult?.stop();
          results.forEach((r) => r?.stop());
          done();
          process.off('SIGINT', processOnExit);
          process.off('SIGTERM', processOnExit);
          process.off('exit', processOnExit);
        };

        process.on('SIGINT', processOnExit);
        process.on('SIGTERM', processOnExit);
        process.on('exit', processOnExit);

        if (!options.skipTypeCheck) {
          const { errors } = await runTypeCheck(options, context);
          hasTypeErrors = errors.length > 0;
        }

        const success =
          results.every((r) => r.errors?.length === 0) && !hasTypeErrors;

        if (!success) {
          logger.info(BUILD_WATCH_FAILED);
        } else {
          logger.info(BUILD_WATCH_SUCCEEDED);
        }
      }
    );
  } else {
    const buildResults = await Promise.all(
      options.format.map((format) =>
        esbuild.build(buildEsbuildOptions(format, options, context))
      )
    );
    const buildSuccess = buildResults.every((r) => r.errors?.length === 0);

    let hasTypeErrors = false;
    if (!options.skipTypeCheck) {
      const { errors } = await runTypeCheck(options, context);
      hasTypeErrors = errors.length > 0;
    }

    if (options.metafile) {
      buildResults.forEach((r, idx) => {
        const filename =
          options.format.length === 1
            ? 'meta.json'
            : `meta.${options.format[idx]}.json`;
        writeJsonSync(
          joinPathFragments(options.outputPath, filename),
          r.metafile
        );
      });
    }

    return { success: buildSuccess && !hasTypeErrors };
  }
}

function getTypeCheckOptions(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const { watch, tsConfig, outputPath } = options;

  const typeCheckOptions: TypeCheckOptions = {
    // TODO(jack): Add support for d.ts declaration files -- once the `@nrwl/js:tsc` changes are in we can use the same logic.
    mode: 'noEmit',
    tsConfigPath: tsConfig,
    // outDir: outputPath,
    workspaceRoot: context.root,
    rootDir: context.root,
  };

  if (watch) {
    typeCheckOptions.incremental = true;
    typeCheckOptions.cacheDir = cacheDir;
  }

  return typeCheckOptions;
}

async function runTypeCheck(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const { errors, warnings } = await _runTypeCheck(
    getTypeCheckOptions(options, context)
  );
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (hasErrors || hasWarnings) {
    await printDiagnostics(errors, warnings);
  }

  return { errors, warnings };
}

export default esbuildExecutor;

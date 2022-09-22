import 'dotenv/config';
import * as chalk from 'chalk';
import type { ExecutorContext } from '@nrwl/devkit';
import { cacheDir, joinPathFragments, logger } from '@nrwl/devkit';
import { parse } from 'path';
import {
  copyAssets,
  copyPackageJson,
  printDiagnostics,
  runTypeCheck as _runTypeCheck,
  TypeCheckOptions,
} from '@nrwl/js';
import * as esbuild from 'esbuild';
import { normalizeOptions } from './lib/normalize';

import { EsBuildExecutorOptions } from './schema';
import { removeSync, writeJsonSync } from 'fs-extra';
import { getClientEnvironment } from '../../utils/environment-variables';
import { createAsyncIterable } from '@nrwl/js/src/utils/create-async-iterable/create-async-iteratable';

const CJS_FILE_EXTENSION = '.cjs';

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
  if (options.clean) removeSync(options.outputPath);

  const assetsResult = await copyAssets(options, context);

  const packageJsonResult = await copyPackageJson(
    {
      ...options,
      skipTypings: options.skipTypeCheck,
      outputFileExtensionForCjs: CJS_FILE_EXTENSION,
    },
    context
  );

  const esbuildOptions: esbuild.BuildOptions = {
    entryPoints: [options.main],
    bundle: true,
    define: getClientEnvironment(),
    external: options.external,
    minify: options.minify,
    platform: options.platform,
    target: options.target,
    metafile: options.metafile,
    tsconfig: options.tsConfig,
  };

  if (options.watch) {
    return yield* createAsyncIterable<{ success: boolean; outfile: string }>(
      async ({ next, done }) => {
        let hasTypeErrors = false;

        const results = await Promise.all(
          options.format.map((format, idx) => {
            const outfile = getOutfile(format, options, context);
            return esbuild.build({
              ...esbuildOptions,
              watch:
                // Only emit info on one of the watch processes.
                idx === 0
                  ? {
                      onRebuild: async (
                        error: esbuild.BuildFailure,
                        result: esbuild.BuildResult
                      ) => {
                        if (!options.skipTypeCheck) {
                          const { errors } = await runTypeCheck(
                            options,
                            context
                          );
                          hasTypeErrors = errors.length > 0;
                        }
                        const success = !error && !hasTypeErrors;

                        if (!success) {
                          logger.info(BUILD_WATCH_FAILED);
                        } else {
                          logger.info(BUILD_WATCH_SUCCEEDED);
                        }

                        next({ success: !!error && !hasTypeErrors, outfile });
                      },
                    }
                  : true,
              format,
              outfile,
            });
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

        next({
          success,
          outfile: getOutfile(options.format[0], options, context),
        });
      }
    );
  } else {
    const buildResults = await Promise.all(
      options.format.map((format) =>
        esbuild.build({
          ...esbuildOptions,
          format,
          outfile: getOutfile(format, options, context),
        })
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
    mode: 'emitDeclarationOnly',
    tsConfigPath: tsConfig,
    outDir: outputPath,
    workspaceRoot: context.root,
    rootDir: context.root,
  };

  if (watch) {
    typeCheckOptions.incremental = true;
    typeCheckOptions.cacheDir = cacheDir;
  }

  return typeCheckOptions;
}

function getOutfile(
  format: 'cjs' | 'esm',
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const candidate = joinPathFragments(
    context.target.options.outputPath,
    options.outputFileName
  );
  if (format === 'esm') {
    return candidate;
  } else {
    const { dir, name } = parse(candidate);
    return `${dir}/${name}${CJS_FILE_EXTENSION}`;
  }
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

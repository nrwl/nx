import 'dotenv/config';
import type { ExecutorContext } from '@nrwl/devkit';
import { cacheDir, joinPathFragments, logger } from '@nrwl/devkit';
import { parse } from 'path';
import {
  copyAssets,
  copyPackageJson,
  printDiagnostics,
  runTypeCheck,
  TypeCheckOptions,
} from '@nrwl/js';
import * as esbuild from 'esbuild';
import { normalizeOptions } from './lib/normalize';

import { EsBuildExecutorOptions } from './schema';
import { removeSync, writeJsonSync } from 'fs-extra';
import { getClientEnvironment } from '../../utils/environment-variables';
import { createAsyncIterable } from '@nrwl/js/src/utils/create-async-iterable/create-async-iteratable';

const CJS_FILE_EXTENSION = '.cjs';

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
  };

  if (options.watch) {
    return yield* createAsyncIterable<{ success: boolean; outfile: string }>(
      async ({ next, done }) => {
        const results = await Promise.all(
          options.format.map((format, idx) => {
            const outfile = getOutfile(format, options, context);
            return esbuild.build({
              ...esbuildOptions,
              metafile: true, // Always include metafile so we can see what files have changed.
              watch:
                // Only emit info on one of the watch processes.
                idx === 0
                  ? {
                      onRebuild: (
                        error: esbuild.BuildFailure,
                        result: esbuild.BuildResult
                      ) => {
                        if (error) {
                          logger.info(`[watch] build failed`);
                        } else if (result?.metafile) {
                          logger.info(
                            `[watch] build succeeded (change: "${
                              Object.keys(result.metafile?.inputs)[0]
                            }")`
                          );
                        } else {
                          logger.info(`[watch] build succeeded`);
                        }
                        next({ success: !!error, outfile });
                      },
                    }
                  : true,
              format,
              outfile,
            });
          })
        );

        logger.info(`[watch] build finished, watching for changes...`);

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

        next({
          success: results.every((r) => r.errors?.length === 0),
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

    if (options.skipTypeCheck) {
      return { success: buildSuccess };
    }

    const { errors, warnings } = await runTypeCheck(
      getTypeCheckOptions(options, context)
    );
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (hasErrors || hasWarnings) {
      await printDiagnostics(errors, warnings);
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

    return { success: buildSuccess && !hasErrors };
  }
}

function getTypeCheckOptions(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const root = context.root;
  const projectRoot = context.workspace.projects[context.projectName].root;
  const { watch, tsConfig, outputPath } = options;

  const typeCheckOptions: TypeCheckOptions = {
    mode: 'emitDeclarationOnly',
    tsConfigPath: tsConfig,
    outDir: outputPath,
    workspaceRoot: root,
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

export default esbuildExecutor;

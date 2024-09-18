import { ExecutorContext, logger } from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { printDiagnostics, runTypeCheck } from '@nx/js';
import { Compiler, MultiCompiler, MultiStats, Stats } from '@rspack/core';
import { rmSync } from 'fs';
import * as path from 'path';
import { createCompiler, isMultiCompiler } from '../../utils/create-compiler';
import { isMode } from '../../utils/mode-utils';
import { RspackExecutorSchema } from './schema';

export default async function* runExecutor(
  options: RspackExecutorSchema,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= options.mode ?? 'production';

  if (isMode(process.env.NODE_ENV)) {
    options.mode = process.env.NODE_ENV;
  }

  if (options.typeCheck) {
    await executeTypeCheck(options, context);
  }

  // Mimic --clean from webpack.
  rmSync(path.join(context.root, options.outputPath), {
    force: true,
    recursive: true,
  });

  const compiler = await createCompiler(options, context);

  const iterable = createAsyncIterable<{
    success: boolean;
    outfile?: string;
  }>(async ({ next, done }) => {
    if (options.watch) {
      const watcher = compiler.watch(
        {},
        async (err, stats: Stats | MultiStats) => {
          if (err) {
            logger.error(err);
            next({ success: false });
            return;
          }
          if (!compiler || !stats) {
            logger.error(new Error('Compiler or stats not available'));
            next({ success: false });
            return;
          }

          const statsOptions = getStatsOptions(compiler);
          const printedStats = stats.toString(statsOptions);
          // Avoid extra empty line when `stats: 'none'`
          if (printedStats) {
            console.error(printedStats);
          }
          next({
            success: !stats.hasErrors(),
            outfile: path.resolve(context.root, options.outputPath, 'main.js'),
          });
        }
      );

      registerCleanupCallback(() => {
        watcher.close(() => {
          logger.info('Watcher closed');
        });
      });
    } else {
      compiler.run(async (err, stats: Stats | MultiStats) => {
        compiler.close(() => {
          if (err) {
            logger.error(err);
            next({ success: false });
            return;
          }
          if (!compiler || !stats) {
            logger.error(new Error('Compiler or stats not available'));
            next({ success: false });
            return;
          }

          const statsOptions = getStatsOptions(compiler);
          const printedStats = stats.toString(statsOptions);
          // Avoid extra empty line when `stats: 'none'`
          if (printedStats) {
            console.error(printedStats);
          }
          next({
            success: !stats.hasErrors(),
            outfile: path.resolve(context.root, options.outputPath, 'main.js'),
          });
          done();
        });
      });
    }
  });

  yield* iterable;
}

// copied from packages/esbuild/src/executors/esbuild/esbuild.impl.ts
function registerCleanupCallback(callback: () => void) {
  const wrapped = () => {
    callback();
    process.off('SIGINT', wrapped);
    process.off('SIGTERM', wrapped);
    process.off('exit', wrapped);
  };

  process.on('SIGINT', wrapped);
  process.on('SIGTERM', wrapped);
  process.on('exit', wrapped);
}

async function executeTypeCheck(
  options: RspackExecutorSchema,
  context: ExecutorContext
) {
  const projectConfiguration =
    context.projectGraph.nodes[context.projectName].data;
  const result = await runTypeCheck({
    workspaceRoot: path.resolve(projectConfiguration.root),
    tsConfigPath: options.tsConfig,
    mode: 'noEmit',
  });

  await printDiagnostics(result.errors, result.warnings);

  if (result.errors.length > 0) {
    throw new Error('Found type errors. See above.');
  }
}

function getStatsOptions(compiler: Compiler | MultiCompiler) {
  return isMultiCompiler(compiler)
    ? {
        children: compiler.compilers.map((compiler) =>
          compiler.options ? compiler.options.stats : undefined
        ),
      }
    : compiler.options
    ? compiler.options.stats
    : undefined;
}

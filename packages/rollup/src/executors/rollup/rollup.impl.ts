import * as rollup from 'rollup';
import { parse, resolve } from 'path';
import { type ExecutorContext, logger } from '@nx/devkit';

import { RollupExecutorOptions } from './schema';
import {
  NormalizedRollupExecutorOptions,
  normalizeRollupExecutorOptions,
} from './lib/normalize';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { withNx } from '../../plugins/with-nx/with-nx';
import { calculateProjectBuildableDependencies } from '@nx/js/src/utils/buildable-libs-utils';

export async function* rollupExecutor(
  rawOptions: RollupExecutorOptions,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= 'production';
  const options = normalizeRollupExecutorOptions(rawOptions, context);
  const rollupOptions = await createRollupOptions(options, context);
  const outfile = resolveOutfile(context, options);

  if (options.watch) {
    // region Watch build
    return yield* createAsyncIterable(({ next }) => {
      const watcher = rollup.watch(rollupOptions);
      watcher.on('event', (data) => {
        if (data.code === 'START') {
          logger.info(`Bundling ${context.projectName}...`);
        } else if (data.code === 'END') {
          logger.info('Bundle complete. Watching for file changes...');
          next({ success: true, outfile });
        } else if (data.code === 'ERROR') {
          logger.error(`Error during bundle: ${data.error.message}`);
          next({ success: false });
        }
      });
      const processExitListener = (signal?: number | NodeJS.Signals) => () => {
        watcher.close();
      };
      process.once('SIGTERM', processExitListener);
      process.once('SIGINT', processExitListener);
      process.once('SIGQUIT', processExitListener);
    });
    // endregion
  } else {
    // region Single build
    try {
      logger.info(`Bundling ${context.projectName}...`);

      const start = process.hrtime.bigint();
      const allRollupOptions = Array.isArray(rollupOptions)
        ? rollupOptions
        : [rollupOptions];

      for (const opts of allRollupOptions) {
        const bundle = await rollup.rollup(opts);
        const output = Array.isArray(opts.output) ? opts.output : [opts.output];

        for (const o of output) {
          await bundle.write(o);
        }
      }

      const end = process.hrtime.bigint();
      const duration = `${(Number(end - start) / 1_000_000_000).toFixed(2)}s`;

      logger.info(`⚡ Done in ${duration}`);
      return { success: true, outfile };
    } catch (e) {
      if (e.formatted) {
        logger.info(e.formatted);
      } else if (e.message) {
        logger.info(e.message);
      }
      logger.error(e);
      logger.error(`Bundle failed: ${context.projectName}`);
      return { success: false };
    }
    // endregion
  }
}

// -----------------------------------------------------------------------------

export async function createRollupOptions(
  options: NormalizedRollupExecutorOptions,
  context: ExecutorContext
): Promise<rollup.RollupOptions | rollup.RollupOptions[]> {
  const { dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
    context.projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName,
    true
  );

  const rollupConfig = withNx(options, {}, dependencies);

  const userDefinedRollupConfigs = options.rollupConfig.map((plugin) =>
    loadConfigFile(plugin)
  );
  let finalConfig: rollup.RollupOptions = rollupConfig;
  for (const _config of userDefinedRollupConfigs) {
    const config = await _config;
    if (typeof config === 'function') {
      finalConfig = config(finalConfig, options);
    } else {
      finalConfig = {
        ...finalConfig,
        ...config,
        plugins: [
          ...(Array.isArray(finalConfig.plugins) &&
          finalConfig.plugins?.length > 0
            ? finalConfig.plugins
            : []),
          ...(config.plugins?.length > 0 ? config.plugins : []),
        ],
      };
    }
  }
  return finalConfig;
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

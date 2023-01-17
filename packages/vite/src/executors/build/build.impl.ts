import 'dotenv/config';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { build, InlineConfig, mergeConfig } from 'vite';
import {
  getViteBuildOptions,
  getViteSharedConfig,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';
import { existsSync } from 'fs';
import { resolve } from 'path';

export default async function* viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const buildConfig = mergeConfig(
    getViteSharedConfig(options, false, context),
    {
      build: getViteBuildOptions(options, context),
    }
  );

  const watcherOrOutput = await runInstance(buildConfig);

  const libraryPackageJson = resolve(projectRoot, 'package.json');
  const rootPackageJson = resolve(context.root, 'package.json');

  // For buildable libs, copy package.json if it exists.
  if (
    existsSync(libraryPackageJson) &&
    rootPackageJson !== libraryPackageJson
  ) {
    await copyAssets(
      {
        outputPath: options.outputPath,
        assets: [
          {
            input: projectRoot,
            output: '.',
            glob: 'package.json',
          },
        ],
      },
      context
    );
  }

  if ('on' in watcherOrOutput) {
    // watcherOrOutput is a RollupWatcher.
    // event is a RollupWatcherEvent.
    const emitter = makeEmitter();
    let success = true;
    watcherOrOutput.on('event', (event: any) => {
      if (event.code === 'START') {
        success = true;
      } else if (event.code === 'ERROR') {
        success = false;
      } else if (event.code === 'END') {
        emitter.push({ success });
      }
      // result must be closed when present.
      // see https://rollupjs.org/guide/en/#rollupwatch
      event.result?.close();
    });
    yield* emitter;
  } else {
    yield { success: true };
  }
}

function runInstance(options: InlineConfig) {
  return build({
    ...options,
  });
}

/**
 * Helper to create an async iterator.
 * Calling push on the returned object emits the value.
 */
function makeEmitter() {
  const events = [];
  let resolve: (value: unknown) => void | null;

  return {
    push: (event) => {
      events.push(event);
      resolve?.(event);
      resolve = null;
    },
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (events.length == 0) {
          await new Promise((r) => (resolve = r));
        }
        return { value: events.shift(), done: false };
      },
    }),
  };
}

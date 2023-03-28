import 'dotenv/config';
import { ExecutorContext } from '@nrwl/devkit';
import { build, InlineConfig, mergeConfig } from 'vite';
import {
  getViteBuildOptions,
  getViteSharedConfig,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createAsyncIterable } from '@nrwl/devkit/src/utils/async-iterable';

import { registerTsConfigPaths } from 'nx/src/utils/register';

export async function* viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  registerTsConfigPaths(resolve(projectRoot, 'tsconfig.json'));

  const normalizedOptions = normalizeOptions(options);

  const buildConfig = mergeConfig(
    getViteSharedConfig(normalizedOptions, false, context),
    {
      build: getViteBuildOptions(normalizedOptions, context),
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
        outputPath: normalizedOptions.outputPath,
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
    const iterable = createAsyncIterable<{ success: boolean }>(({ next }) => {
      let success = true;
      watcherOrOutput.on('event', (event) => {
        if (event.code === 'START') {
          success = true;
        } else if (event.code === 'ERROR') {
          success = false;
        } else if (event.code === 'END') {
          next({ success });
        }
        // result must be closed when present.
        // see https://rollupjs.org/guide/en/#rollupwatch
        if ('result' in event) {
          event.result.close();
        }
      });
    });
    yield* iterable;
  } else {
    const output = watcherOrOutput?.['output'] || watcherOrOutput?.[0]?.output;
    const fileName = output?.[0]?.fileName || 'main.cjs';
    const outfile = resolve(normalizedOptions.outputPath, fileName);
    yield { success: true, outfile };
  }
}

function runInstance(options: InlineConfig) {
  return build({
    ...options,
  });
}

function normalizeOptions(options: ViteBuildExecutorOptions) {
  const normalizedOptions = { ...options };

  // coerce watch to null or {} to match with Vite's watch config
  if (options.watch === false) {
    normalizedOptions.watch = null;
  } else if (options.watch === true) {
    normalizedOptions.watch = {};
  }

  return normalizedOptions;
}

export default viteBuildExecutor;

import 'dotenv/config';

import type { ExecutorContext } from '@nrwl/devkit';

import {
  convertNxExecutor,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nrwl/devkit';
import { jestExecutor } from '@nrwl/jest/src/executors/jest/jest.impl';
import type { NxPluginE2EExecutorOptions } from './schema';

export async function* nxPluginE2EExecutor(
  options: NxPluginE2EExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
  let success: boolean;
  for await (const _ of runBuildTarget(options.target, context)) {
    try {
      success = await runTests(options.jestConfig, context);
    } catch (e) {
      logger.error(e.message);
      success = false;
    }
  }

  return { success };
}

async function* runBuildTarget(
  buildTarget: string,
  context: ExecutorContext
): AsyncGenerator<boolean> {
  const { project, target, configuration } = parseTargetString(buildTarget);
  const buildTargetOptions = readTargetOptions(
    { project, target, configuration },
    context
  );
  const targetSupportsWatch = Object.keys(buildTargetOptions).includes('watch');

  for await (const output of await runExecutor<{ success: boolean }>(
    { project, target, configuration },
    targetSupportsWatch ? { watch: false } : {},
    context
  )) {
    if (!output.success)
      throw new Error('Could not compile application files.');
    yield output.success;
  }
}

async function runTests(
  jestConfig: string,
  context: ExecutorContext
): Promise<boolean> {
  const { success } = await jestExecutor({ jestConfig, watch: false }, context);

  return success;
}

export default nxPluginE2EExecutor;

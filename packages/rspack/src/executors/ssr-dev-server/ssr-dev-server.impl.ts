import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nx/devkit';
import { combineAsyncIterables } from '@nx/devkit/src/utils/async-iterable';
import * as chalk from 'chalk';

import { RspackExecutorSchema } from '../rspack/schema';
import { waitUntilServerIsListening } from './lib/wait-until-server-is-listening';
import { RspackSsrDevServerOptions, TargetOptions } from './schema';

export async function* ssrDevServerExecutor(
  options: RspackSsrDevServerOptions,
  context: ExecutorContext
) {
  const browserTarget = parseTargetString(
    options.browserTarget,
    context.projectGraph
  );
  const serverTarget = parseTargetString(options.serverTarget, context);
  const browserOptions = readTargetOptions<RspackExecutorSchema>(
    browserTarget,
    context
  );
  const serverOptions = readTargetOptions<RspackExecutorSchema>(
    serverTarget,
    context
  );

  const runBrowser = await runExecutor<{
    success: boolean;
    baseUrl?: string;
    options: TargetOptions;
  }>(
    browserTarget,
    { ...browserOptions, ...options.browserTargetOptions },
    context
  );
  const runServer = await runExecutor<{
    success: boolean;
    baseUrl?: string;
    options: TargetOptions;
  }>(
    serverTarget,
    { ...serverOptions, ...options.serverTargetOptions },
    context
  );
  let browserBuilt = false;
  let nodeStarted = false;
  const combined = combineAsyncIterables(runBrowser, runServer);

  for await (const output of combined) {
    if (!output.success) throw new Error('Could not build application');
    if (output.options?.target === 'node') {
      nodeStarted = true;
    } else if (output.options?.target === 'web') {
      browserBuilt = true;
    }

    if (nodeStarted && browserBuilt) {
      await waitUntilServerIsListening(options.port);
      console.log(
        `[ ${chalk.green('ready')} ] on http://localhost:${options.port}`
      );
      yield {
        ...output,
        baseUrl: `http://localhost:${options.port}`,
      };
    }
  }
}

export default ssrDevServerExecutor;

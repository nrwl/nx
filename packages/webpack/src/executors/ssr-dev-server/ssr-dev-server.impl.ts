import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nx/devkit';
import * as chalk from 'chalk';
import { combineAsyncIterables } from '@nx/devkit/src/utils/async-iterable';

import { WebpackExecutorOptions } from '../webpack/schema';
import { TargetOptions, WebSsrDevServerOptions } from './schema';
import { waitUntilServerIsListening } from './lib/wait-until-server-is-listening';

export async function* ssrDevServerExecutor(
  options: WebSsrDevServerOptions,
  context: ExecutorContext
) {
  const browserTarget = parseTargetString(
    options.browserTarget,
    context.projectGraph
  );
  const serverTarget = parseTargetString(
    options.serverTarget,
    context.projectGraph
  );
  const browserOptions = readTargetOptions<WebpackExecutorOptions>(
    browserTarget,
    context
  );
  const serverOptions = readTargetOptions<WebpackExecutorOptions>(
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

  process.env['port'] = `${options.port}`;

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

import 'dotenv/config';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { join, resolve } from 'path';

import {
  NextBuildBuilderOptions,
  NextServeBuilderOptions,
} from '../../utils/types';
import { fork } from 'child_process';
import customServer from './custom-server.impl';
import { createCliOptions } from '../../utils/create-cli-options';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';

export default async function* serveExecutor(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  if (options.customServerTarget) {
    return yield* customServer(options, context);
  }

  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    parseTargetString(options.buildTarget, context.projectGraph),
    context
  );
  const projectRoot = context.workspace.projects[context.projectName].root;

  const { port, keepAliveTimeout, hostname } = options;

  // This is required for the default custom server to work. See the @nx/next:app generator.
  process.env.NX_NEXT_DIR = projectRoot;

  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV = process.env.NODE_ENV
    ? process.env.NODE_ENV
    : options.dev
    ? 'development'
    : 'production';

  // Setting port that the custom server should use.
  process.env.PORT = `${options.port}`;

  const args = createCliOptions({ port, hostname });

  if (keepAliveTimeout && !options.dev) {
    args.push(`--keepAliveTimeout=${keepAliveTimeout}`);
  }

  const nextDir = resolve(context.root, buildOptions.outputPath);

  const mode = options.dev ? 'dev' : 'start';
  const turbo = options.turbo && options.dev ? '--turbo' : '';
  const nextBin = require.resolve('next/dist/bin/next');

  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    async ({ done, next, error }) => {
      const server = fork(nextBin, [mode, ...args, turbo], {
        cwd: options.dev ? projectRoot : nextDir,
        stdio: 'inherit',
      });

      server.once('exit', (code) => {
        if (code === 0) {
          done();
        } else {
          error(new Error(`Next.js app exited with code ${code}`));
        }
      });

      const killServer = () => {
        if (server.connected) {
          server.kill('SIGTERM');
        }
      };
      process.on('exit', () => killServer());
      process.on('SIGINT', () => killServer());
      process.on('SIGTERM', () => killServer());
      process.on('SIGHUP', () => killServer());

      await waitForPortOpen(port);

      next({
        success: true,
        baseUrl: `http://${options.hostname ?? 'localhost'}:${port}`,
      });
    }
  );
}

import 'dotenv/config';
import * as net from 'net';
import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { resolve } from 'path';

import {
  NextBuildBuilderOptions,
  NextServeBuilderOptions,
} from '../../utils/types';
import { spawn } from 'child_process';
import customServer from './custom-server.impl';
import { createCliOptions } from '../../utils/create-cli-options';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';

export default async function* serveExecutor(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  if (options.customServerTarget) {
    return yield* customServer(options, context);
  }
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV = process.env.NODE_ENV
    ? process.env.NODE_ENV
    : options.dev
    ? 'development'
    : 'production';

  // Setting port that the custom server should use.
  (process.env as any).PORT = options.port;

  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    parseTargetString(options.buildTarget, context.projectGraph),
    context
  );
  const root = resolve(context.root, buildOptions.root);

  const { port, keepAliveTimeout, hostname } = options;

  const args = createCliOptions({ port, keepAliveTimeout, hostname });

  const nextDir = resolve(context.root, buildOptions.outputPath);

  const mode = options.dev ? 'dev' : 'start';
  const turbo = options.turbo && options.dev ? '--turbo' : '';
  const command = `npx next ${mode} ${args} ${turbo}`;
  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    ({ done, next, error }) => {
      // Client to check if server is ready.
      const client = new net.Socket();
      const cleanupClient = () => {
        client.removeAllListeners('connect');
        client.removeAllListeners('error');
        client.end();
        client.destroy();
        client.unref();
      };

      const waitForServerReady = (retries = 30) => {
        const allowedErrorCodes = ['ECONNREFUSED', 'ECONNRESET'];

        client.once('connect', () => {
          cleanupClient();
          next({
            success: true,
            baseUrl: `http://${options.hostname ?? 'localhost'}:${port}`,
          });
        });

        client.on('error', (err) => {
          if (retries === 0 || !allowedErrorCodes.includes(err['code'])) {
            cleanupClient();
            error(err);
          } else {
            setTimeout(() => waitForServerReady(retries - 1), 1000);
          }
        });

        client.connect({ port, host: '127.0.0.1' });
      };

      const server = spawn(command, {
        cwd: options.dev ? root : nextDir,
        stdio: 'inherit',
        shell: true,
      });

      waitForServerReady();

      server.once('exit', (code) => {
        cleanupClient();
        if (code === 0) {
          done();
        } else {
          error(new Error(`Next.js app exited with code ${code}`));
        }
      });

      process.on('exit', async (code) => {
        if (code === 128 + 2) {
          server.kill('SIGINT');
        } else if (code === 128 + 1) {
          server.kill('SIGHUP');
        } else {
          server.kill('SIGTERM');
        }
      });
    }
  );
}

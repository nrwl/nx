import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { resolve } from 'path';

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
  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    parseTargetString(options.buildTarget, context),
    context
  );
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  // This is required for the default custom server to work. See the @nx/next:app generator.
  const nextDir =
    !options.dev && resolve(context.root, buildOptions.outputPath);
  process.env.NX_NEXT_DIR ??= options.dev ? projectRoot : nextDir;

  if (options.customServerTarget) {
    return yield* customServer(options, context);
  }

  const { keepAliveTimeout, hostname } = options;

  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV = process.env.NODE_ENV
    ? process.env.NODE_ENV
    : options.dev
    ? 'development'
    : 'production';

  // Setting port that the custom server should use.
  process.env.PORT = options.port ? `${options.port}` : process.env.PORT;
  options.port = parseInt(process.env.PORT);

  const args = createCliOptions({ port: options.port, hostname });

  if (keepAliveTimeout && !options.dev) {
    args.push(`--keepAliveTimeout=${keepAliveTimeout}`);
  }

  const mode = options.dev ? 'dev' : 'start';
  const turbo = options.turbo && options.dev ? '--turbo' : '';
  const nextBin = require.resolve('next/dist/bin/next');

  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    async ({ done, next, error }) => {
      const server = fork(
        nextBin,
        [mode, ...args, turbo, ...getExperimentalHttpsFlags(options)],
        {
          cwd: options.dev ? projectRoot : nextDir,
          stdio: 'inherit',
        }
      );

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

      await waitForPortOpen(options.port, { host: options.hostname });

      next({
        success: true,
        baseUrl: `http://${options.hostname ?? 'localhost'}:${options.port}`,
      });
    }
  );
}

function getExperimentalHttpsFlags(options: NextServeBuilderOptions): string[] {
  if (!options.dev) return [];
  const flags: string[] = [];
  if (options.experimentalHttps) flags.push('--experimental-https');
  if (options.experimentalHttpsKey)
    flags.push(`--experimental-https-key=${options.experimentalHttpsKey}`);
  if (options.experimentalHttpsCert)
    flags.push(`--experimental-https-cert=${options.experimentalHttpsCert}`);
  if (options.experimentalHttpsCa)
    flags.push(`--experimental-https-ca=${options.experimentalHttpsCa}`);
  return flags;
}

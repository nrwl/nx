import 'dotenv/config';
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
import { spawn } from 'child_process';
import customServer from './custom-server.impl';
import { formatObjectToCli } from './formatObjectToCli';

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

  const args = formatObjectToCli({ port, keepAliveTimeout, hostname });
  const nextDir = resolve(context.root, buildOptions.outputPath);

  const command = `next ${
    options.dev ? `dev ${args}` : `start ${nextDir} ${args}`
  }`;

  return yield new Promise<{ success: boolean }>((res, rej) => {
    const server = spawn(command, {
      cwd: options.dev ? root : nextDir,
      stdio: 'inherit',
      shell: true,
    });

    server.on('exit', (code) => {
      code != 0 ? rej({ success: false }) : res({ success: true });
    });
  });
}

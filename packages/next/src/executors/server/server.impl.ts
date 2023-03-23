import 'dotenv/config';
import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nrwl/devkit';
import * as chalk from 'chalk';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

import {
  NextBuildBuilderOptions,
  NextServeBuilderOptions,
  NextServer,
  NextServerOptions,
  ProxyConfig,
} from '../../utils/types';
import { customServer } from './lib/custom-server';
import { defaultServer } from './lib/default-server';

export default async function* serveExecutor(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
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

  if (options.customServerTarget) {
    yield* runCustomServer(root, options, buildOptions, context);
  } else {
    yield* runNextDevServer(root, options, buildOptions, context);
  }
}

async function* runNextDevServer(
  root: string,
  options: NextServeBuilderOptions,
  buildOptions: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;
  const settings: NextServerOptions = {
    dev: options.dev,
    dir: root,
    staticMarkup: options.staticMarkup,
    quiet: options.quiet,
    port: options.port,
    customServer: !!options.customServerTarget,
    hostname: options.hostname || 'localhost',

    // TOOD(jack): Remove in Nx 15
    path: options.customServerPath,
  };

  const server: NextServer = options.customServerPath
    ? customServer
    : defaultServer;

  // look for the proxy.conf.json
  let proxyConfig: ProxyConfig;
  const proxyConfigPath = options.proxyConfig
    ? join(context.root, options.proxyConfig)
    : join(root, 'proxy.conf.json');

  // TODO(v16): Remove proxy support.
  if (existsSync(proxyConfigPath)) {
    logger.warn(
      `The "proxyConfig" option will be removed in Nx 16. Use the "rewrites" feature from Next.js instead. See: https://nextjs.org/docs/api-reference/next.config.js/rewrites`
    );
    proxyConfig = require(proxyConfigPath);
  }

  try {
    await server(settings, proxyConfig);
    logger.info(`[ ${chalk.green('ready')} ] on ${baseUrl}`);

    yield {
      baseUrl,
      success: true,
    };

    // This Promise intentionally never resolves, leaving the process running
    await new Promise<{ success: boolean }>(() => {});
  } catch (e) {
    if (options.dev) {
      throw e;
    } else {
      if (process.env.NX_VERBOSE_LOGGING) {
        console.error(e);
      }
      throw new Error(
        `Could not start production server. Try building your app with \`nx build ${context.projectName}\`.`
      );
    }
  }
}

async function* runCustomServer(
  root: string,
  options: NextServeBuilderOptions,
  buildOptions: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  process.env.NX_NEXT_DIR = root;
  process.env.NX_NEXT_PUBLIC_DIR = join(root, 'public');

  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;

  const customServerBuild = await runExecutor(
    parseTargetString(options.customServerTarget, context.projectGraph),
    {
      watch: options.dev ? true : false,
    },
    context
  );

  for await (const result of customServerBuild) {
    if (!result.success) {
      return result;
    }
    yield {
      success: true,
      baseUrl,
    };
  }

  return { success: true };
}

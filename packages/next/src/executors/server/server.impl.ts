import 'dotenv/config';
import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  workspaceLayout,
} from '@nrwl/devkit';
import * as chalk from 'chalk';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { calculateProjectDependencies } from '@nrwl/workspace/src/utilities/buildable-libs-utils';

import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextServeBuilderOptions,
  NextServer,
  NextServerOptions,
  ProxyConfig,
} from '../../utils/types';
import { customServer } from './lib/custom-server';
import { defaultServer } from './lib/default-server';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER,
} from '../../utils/constants';

const infoPrefix = `[ ${chalk.dim(chalk.cyan('info'))} ] `;

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
    parseTargetString(options.buildTarget),
    context
  );
  const root = resolve(context.root, buildOptions.root);
  const config = await prepareConfig(
    options.dev ? PHASE_DEVELOPMENT_SERVER : PHASE_PRODUCTION_SERVER,
    buildOptions,
    context,
    getDependencies(options, context),
    join(context.root, workspaceLayout().libsDir)
  );

  if (options.customServerTarget) {
    yield* runCustomServer(root, config, options, buildOptions, context);
  } else {
    yield* runNextDevServer(root, config, options, buildOptions, context);
  }
}

function getDependencies(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  if (options.buildLibsFromSource) {
    return [];
  } else {
    const result = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      'build', // should be generalized
      context.configurationName
    );
    return result.dependencies;
  }
}

async function* runNextDevServer(
  root: string,
  config: ReturnType<typeof prepareConfig>,
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
    conf: config,
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

  if (existsSync(proxyConfigPath)) {
    logger.info(
      `${infoPrefix} found proxy configuration at ${proxyConfigPath}`
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
      throw new Error(
        `Could not start production server. Try building your app with \`nx build ${context.projectName}\`.`
      );
    }
  }
}

async function* runCustomServer(
  root: string,
  config: ReturnType<typeof prepareConfig>,
  options: NextServeBuilderOptions,
  buildOptions: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  process.env.NX_NEXT_DIR = root;
  process.env.NX_NEXT_PUBLIC_DIR = join(root, 'public');

  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;

  const customServerBuild = await runExecutor(
    parseTargetString(options.customServerTarget),
    {
      watch: true,
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

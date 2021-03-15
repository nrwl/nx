import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER,
} from 'next/dist/next-server/lib/constants';

import * as chalk from 'chalk';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

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

try {
  require('dotenv').config();
} catch (e) {}

const infoPrefix = `[ ${chalk.dim(chalk.cyan('info'))} ] `;
const readyPrefix = `[ ${chalk.green('ready')} ]`;

export default async function* serveExecutor(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  const buildTarget = parseTargetString(options.buildTarget);
  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;
  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    buildTarget,
    context
  );
  const root = resolve(context.root, buildOptions.root);
  const config = await prepareConfig(
    options.dev ? PHASE_DEVELOPMENT_SERVER : PHASE_PRODUCTION_SERVER,
    buildOptions,
    context
  );
  const settings: NextServerOptions = {
    dev: options.dev,
    dir: root,
    staticMarkup: options.staticMarkup,
    quiet: options.quiet,
    conf: config,
    port: options.port,
    path: options.customServerPath,
    hostname: options.hostname,
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
    logger.info(`${readyPrefix} on ${baseUrl}`);

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

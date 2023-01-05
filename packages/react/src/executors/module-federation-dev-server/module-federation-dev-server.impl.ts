import { ExecutorContext, logger, runExecutor } from '@nrwl/devkit';
import devServerExecutor from '@nrwl/webpack/src/executors/dev-server/dev-server.impl';
import { WebDevServerOptions } from '@nrwl/webpack/src/executors/dev-server/schema';
import { join } from 'path';
import * as chalk from 'chalk';
import {
  combineAsyncIterables,
  tapAsyncIterable,
} from '@nrwl/devkit/src/utils/async-iterable';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string | string[];
  skipRemotes?: string[];
};

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
) {
  let iter = devServerExecutor(options, context);
  const p = context.projectsConfigurations.projects[context.projectName];

  const moduleFederationConfigPath = join(
    context.root,
    p.root,
    'module-federation.config.js'
  );

  let moduleFederationConfig: any;
  try {
    moduleFederationConfig = require(moduleFederationConfigPath);
  } catch {
    // TODO(jack): Add a link to guide
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nrwl/react:host"?`
    );
  }

  const remotesToSkip = new Set(options.skipRemotes ?? []);
  const knownRemotes = (moduleFederationConfig.remotes ?? []).filter((r) => {
    const validRemote = Array.isArray(r) ? r[0] : r;
    return !remotesToSkip.has(validRemote);
  });

  const devServeApps = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  for (const app of knownRemotes) {
    const [appName] = Array.isArray(app) ? app : [app];
    const isDev = devServeApps.includes(appName);
    iter = combineAsyncIterables(
      iter,
      await runExecutor(
        {
          project: appName,
          target: isDev ? 'serve' : 'serve-static',
          configuration: context.configurationName,
        },
        {
          watch: isDev,
        },
        context
      )
    );
  }

  let numAwaiting = knownRemotes.length + 1; // remotes + host
  return yield* tapAsyncIterable(iter, (x) => {
    numAwaiting--;
    if (numAwaiting === 0) {
      logger.info(
        `[ ${chalk.green('ready')} ] http://${options.host ?? 'localhost'}:${
          options.port ?? 4200
        }`
      );
    }
  });
}

import {
  ExecutorContext,
  logger,
  runExecutor,
  workspaceRoot,
} from '@nx/devkit';
import ssrDevServerExecutor from '@nx/webpack/src/executors/ssr-dev-server/ssr-dev-server.impl';
import { WebSsrDevServerOptions } from '@nx/webpack/src/executors/ssr-dev-server/schema';
import { join } from 'path';
import * as chalk from 'chalk';
import {
  combineAsyncIterables,
  createAsyncIterable,
  mapAsyncIterable,
  tapAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { execSync, fork } from 'child_process';

type ModuleFederationDevServerOptions = WebSsrDevServerOptions & {
  devRemotes?: string | string[];
  skipRemotes?: string[];
  host: string;
};

export default async function* moduleFederationSsrDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
) {
  let iter: any = ssrDevServerExecutor(options, context);
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
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nx/react:host"?`
    );
  }

  const remotesToSkip = new Set(options.skipRemotes ?? []);
  const knownRemotes = (moduleFederationConfig.remotes ?? []).filter(
    (r) => !remotesToSkip.has(r)
  );

  const devServeApps = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  for (const app of knownRemotes) {
    const [appName] = Array.isArray(app) ? app : [app];
    const isDev = devServeApps.includes(appName);
    const remoteServeIter = isDev
      ? await runExecutor(
          {
            project: appName,
            target: 'serve',
            configuration: context.configurationName,
          },
          {
            watch: isDev,
          },
          context
        )
      : mapAsyncIterable(
          createAsyncIterable(async ({ next, done }) => {
            const remoteProject =
              context.projectsConfigurations.projects[appName];
            const remoteServerOutput = join(
              workspaceRoot,
              remoteProject.targets.server.options.outputPath,
              'main.js'
            );
            execSync(
              `npx nx run ${appName}:server${
                context.configurationName ? `:${context.configurationName}` : ''
              }`,
              { stdio: 'inherit' }
            );
            const child = fork(remoteServerOutput, {
              env: {
                PORT: remoteProject.targets['serve-browser'].options.port,
              },
            });

            child.on('message', (msg) => {
              if (msg === 'nx.server.ready') {
                next(true);
                done();
              }
            });
          }),
          (x) => x
        );

    iter = combineAsyncIterables(iter, remoteServeIter);
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

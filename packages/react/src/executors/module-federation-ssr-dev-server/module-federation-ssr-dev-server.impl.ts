import {
  ExecutorContext,
  getPackageManagerCommand,
  logger,
  parseTargetString,
  readTargetOptions,
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
import { existsSync } from 'fs';
import { registerTsProject } from '@nx/js/src/internal';

type ModuleFederationDevServerOptions = WebSsrDevServerOptions & {
  devRemotes?: string | string[];
  skipRemotes?: string[];
  host: string;
};

function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

function getModuleFederationConfig(
  tsconfigPath: string,
  workspaceRoot: string,
  projectRoot: string
) {
  const moduleFederationConfigPathJS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.js'
  );

  const moduleFederationConfigPathTS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.ts'
  );

  let moduleFederationConfigPath = moduleFederationConfigPathJS;

  const fullTSconfigPath = tsconfigPath.startsWith(workspaceRoot)
    ? tsconfigPath
    : join(workspaceRoot, tsconfigPath);
  // create a no-op so this can be called with issue
  let cleanupTranspiler = () => {};
  if (existsSync(moduleFederationConfigPathTS)) {
    cleanupTranspiler = registerTsProject(fullTSconfigPath);
    moduleFederationConfigPath = moduleFederationConfigPathTS;
  }

  try {
    const config = require(moduleFederationConfigPath);
    cleanupTranspiler();

    return config.default || config;
  } catch {
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nx/react:host"?\nSee: https://nx.dev/concepts/more-concepts/faster-builds-with-module-federation`
    );
  }
}

export default async function* moduleFederationSsrDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
) {
  let iter: any = ssrDevServerExecutor(options, context);
  const p = context.projectsConfigurations.projects[context.projectName];
  const buildOptions = getBuildOptions(options.browserTarget, context);
  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root
  );

  const remotesToSkip = new Set(options.skipRemotes ?? []);
  const remotesNotInWorkspace: string[] = [];
  const knownRemotes = (moduleFederationConfig.remotes ?? []).filter((r) => {
    const validRemote = Array.isArray(r) ? r[0] : r;

    if (remotesToSkip.has(validRemote)) {
      return false;
    } else if (!context.projectGraph.nodes[validRemote]) {
      remotesNotInWorkspace.push(validRemote);
      return false;
    } else {
      return true;
    }
  });

  if (remotesNotInWorkspace.length > 0) {
    logger.warn(
      `Skipping serving ${remotesNotInWorkspace.join(
        ', '
      )} as they could not be found in the workspace. Ensure they are served correctly.`
    );
  }

  const devServeApps = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  // Set NX_MF_DEV_REMOTES for the Nx Runtime Library Control Plugin
  process.env.NX_MF_DEV_REMOTES = JSON.stringify(devServeApps);

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
              remoteProject.targets.server.options.outputFileName
            );
            const pm = getPackageManagerCommand();
            execSync(
              `${pm.exec} nx run ${appName}:server${
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

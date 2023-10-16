import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nx/devkit';
import devServerExecutor from '@nx/webpack/src/executors/dev-server/dev-server.impl';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { WebDevServerOptions } from '@nx/webpack/src/executors/dev-server/schema';
import { join } from 'path';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import * as chalk from 'chalk';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';
import { fork } from 'child_process';
import { existsSync } from 'fs';
import { registerTsProject } from '@nx/js/src/internal';
import { type ModuleFederationConfig } from '@nx/webpack';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string[];
  skipRemotes?: string[];
  static?: boolean;
  isInitialHost?: boolean;
};

function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

function extractRemoteProjectsFromConfig(config: ModuleFederationConfig) {
  return config.remotes?.map((r) => (Array.isArray(r) ? r[0] : r)) ?? [];
}

function collectRemoteProjects(
  remote: string,
  collected: Set<string>,
  context: ExecutorContext
) {
  const remoteProject = context.projectGraph.nodes[remote]?.data;
  if (!context.projectGraph.nodes[remote] || collected.has(remote)) {
    return;
  }

  collected.add(remote);

  const remoteProjectRoot = remoteProject.root;
  const remoteProjectTsConfig = remoteProject.targets['build'].options.tsConfig;
  const remoteProjectConfig = getModuleFederationConfig(
    remoteProjectTsConfig,
    context.root,
    remoteProjectRoot
  );
  const remoteProjectRemotes =
    extractRemoteProjectsFromConfig(remoteProjectConfig);

  remoteProjectRemotes.forEach((r) =>
    collectRemoteProjects(r, collected, context)
  );
}

function getRemotes(
  devRemotes: string[],
  skipRemotes: string[],
  config: ModuleFederationConfig,
  context: ExecutorContext
) {
  const collectedRemotes = new Set<string>();
  const remotes = extractRemoteProjectsFromConfig(config);
  remotes.forEach((r) => collectRemoteProjects(r, collectedRemotes, context));
  const remotesToSkip = new Set(
    findMatchingProjects(skipRemotes, context.projectGraph.nodes) ?? []
  );

  if (remotesToSkip.size > 0) {
    logger.info(
      `Remotes not served automatically: ${[...remotesToSkip.values()].join(
        ', '
      )}`
    );
  }

  const knownRemotes = Array.from(collectedRemotes).filter(
    (r) => !remotesToSkip.has(r)
  );

  logger.info(
    `NX Starting module federation dev-server for ${chalk.bold(
      context.projectName
    )} with ${knownRemotes.length} remotes`
  );

  const devServeApps = new Set(
    !devRemotes
      ? []
      : Array.isArray(devRemotes)
      ? findMatchingProjects(devRemotes, context.projectGraph.nodes)
      : findMatchingProjects([devRemotes], context.projectGraph.nodes)
  );

  const staticRemotes = knownRemotes.filter((r) => !devServeApps.has(r));
  const devServeRemotes = knownRemotes.filter((r) => devServeApps.has(r));
  const remotePorts = knownRemotes.map(
    (r) => context.projectGraph.nodes[r].data.targets['serve'].options.port
  );

  return {
    staticRemotes,
    devRemotes: devServeRemotes,
    remotePorts,
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

  // create a no-op so this can be called with issue
  const fullTSconfigPath = tsconfigPath.startsWith(workspaceRoot)
    ? tsconfigPath
    : join(workspaceRoot, tsconfigPath);
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

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  const nxBin = require.resolve('nx');
  const currIter = options.static
    ? fileServerExecutor(
        {
          ...options,
          parallel: false,
          withDeps: false,
          spa: false,
          cors: true,
        },
        context
      )
    : devServerExecutor(options, context);

  const p = context.projectsConfigurations.projects[context.projectName];
  const buildOptions = getBuildOptions(options.buildTarget, context);

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root
  );

  const remotes = getRemotes(
    options.devRemotes,
    options.skipRemotes,
    moduleFederationConfig,
    context
  );

  const devRemoteIters: AsyncIterable<{ success: boolean }>[] = [];
  let isCollectingStaticRemoteOutput = true;

  for (const app of remotes.devRemotes) {
    const remoteProjectServeTarget =
      context.projectGraph.nodes[app].data.targets['serve'];
    const isUsingModuleFederationDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-dev-server'
      );

    devRemoteIters.push(
      await runExecutor(
        {
          project: app,
          target: 'serve',
          configuration: context.configurationName,
        },
        {
          watch: true,
          ...(isUsingModuleFederationDevServerExecutor
            ? { isInitialHost: false }
            : {}),
        },
        context
      )
    );
  }
  for (const app of remotes.staticRemotes) {
    const remoteProjectServeTarget =
      context.projectGraph.nodes[app].data.targets['serve-static'];
    const isUsingModuleFederationDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-dev-server'
      );
    let outWithErr: null | string[] = [];
    const staticProcess = fork(
      nxBin,
      [
        'run',
        `${app}:serve-static${
          context.configurationName ? `:${context.configurationName}` : ''
        }`,
        ...(isUsingModuleFederationDevServerExecutor
          ? [`--isInitialHost=false`]
          : []),
      ],
      {
        cwd: context.root,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    staticProcess.stdout.on('data', (data) => {
      if (isCollectingStaticRemoteOutput) {
        outWithErr.push(data.toString());
      } else {
        outWithErr = null;
        staticProcess.stdout.removeAllListeners('data');
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.info(outWithErr.join(''));
        throw new Error(`Remote failed to start. See above for errors.`);
      }
    });
    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  }

  return yield* combineAsyncIterables(
    currIter,
    ...devRemoteIters,
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (remotes.remotePorts.length === 0) {
          done();
          return;
        }
        try {
          await Promise.all(
            remotes.remotePorts.map((port) =>
              // Allow 20 minutes for each remote to start, which is plenty of time but we can tweak it later if needed.
              // Most remotes should start in under 1 minute.
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: 'localhost',
              })
            )
          );
          isCollectingStaticRemoteOutput = false;
          logger.info(
            `NX All remotes started, server ready at http://localhost:${options.port}`
          );
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
        } catch {
          throw new Error(
            `Timed out waiting for remote to start. Check above for any errors.`
          );
        } finally {
          done();
        }
      }
    )
  );
}

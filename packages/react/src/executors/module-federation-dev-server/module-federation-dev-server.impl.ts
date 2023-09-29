import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nx/devkit';
import devServerExecutor from '@nx/webpack/src/executors/dev-server/dev-server.impl';
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
import { tsNodeRegister } from '@nx/js/src/utils/typescript/tsnode-register';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string | string[];
  skipRemotes?: string[];
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

  // create a no-op so this can be called with issue
  let tsNodeService;
  if (existsSync(moduleFederationConfigPathTS)) {
    tsNodeService = tsNodeRegister(moduleFederationConfigPathTS, tsconfigPath, {
      transpileOnly: true,
    });
    moduleFederationConfigPath = moduleFederationConfigPathTS;
  }

  try {
    const config = require(moduleFederationConfigPath);
    if (tsNodeService) {
      tsNodeService.enabled(false);
    }
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
  const currIter = devServerExecutor(options, context);
  const p = context.projectsConfigurations.projects[context.projectName];
  const buildOptions = getBuildOptions(options.buildTarget, context);

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root
  );

  const remotesToSkip = new Set(
    findMatchingProjects(options.skipRemotes, context.projectGraph.nodes) ?? []
  );

  if (remotesToSkip.size > 0) {
    logger.info(
      `Remotes not served automatically: ${[...remotesToSkip.values()].join(
        ', '
      )}`
    );
  }
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

  const remotePorts = knownRemotes.map(
    (r) => context.projectGraph.nodes[r].data.targets['serve'].options.port
  );

  const devServeApps = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? findMatchingProjects(options.devRemotes, context.projectGraph.nodes)
    : findMatchingProjects([options.devRemotes], context.projectGraph.nodes);

  logger.info(
    `NX Starting module federation dev-server for ${chalk.bold(
      context.projectName
    )} with ${knownRemotes.length} remotes`
  );

  const devRemoteIters: AsyncIterable<{ success: boolean }>[] = [];
  let isCollectingStaticRemoteOutput = true;

  for (const app of knownRemotes) {
    const appName = Array.isArray(app) ? app[0] : app;
    if (devServeApps.includes(appName)) {
      devRemoteIters.push(
        await runExecutor(
          {
            project: appName,
            target: 'serve',
            configuration: context.configurationName,
          },
          {
            watch: true,
          },
          context
        )
      );
    } else {
      let outWithErr: null | string[] = [];
      const staticProcess = fork(
        nxBin,
        [
          'run',
          `${appName}:serve-static${
            context.configurationName ? `:${context.configurationName}` : ''
          }`,
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
  }

  return yield* combineAsyncIterables(
    currIter,
    ...devRemoteIters,
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (remotePorts.length === 0) {
          done();
          return;
        }
        try {
          await Promise.all(
            remotePorts.map((port) =>
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

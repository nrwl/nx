import { ExecutorContext, logger, runExecutor } from '@nx/devkit';
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

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string | string[];
  skipRemotes?: string[];
};

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  const currIter = devServerExecutor(options, context);
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
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nx/react:host"?\nSee: https://nx.dev/recipes/module-federation/faster-builds`
    );
  }

  const remotesToSkip = new Set(
    findMatchingProjects(options.skipRemotes ?? [], context.projectGraph.nodes)
  );
  const knownRemotes = (moduleFederationConfig.remotes ?? []).filter((r) => {
    const validRemote = Array.isArray(r) ? r[0] : r;
    return !remotesToSkip.has(validRemote);
  });
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

  const nxBin = require.resolve('nx');
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

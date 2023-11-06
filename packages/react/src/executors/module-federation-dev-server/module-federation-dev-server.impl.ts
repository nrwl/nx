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
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { fork } from 'child_process';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string[];
  skipRemotes?: string[];
  static?: boolean;
  isInitialHost?: boolean;
  parallel?: number;
};

function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
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

  if (!options.isInitialHost) {
    return yield* currIter;
  }

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root,
    'react'
  );

  const remotes = getRemotes(
    options.devRemotes,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: context.projectName,
      projectGraph: context.projectGraph,
      root: context.root,
    }
  );

  logger.info(`NX Building ${remotes.staticRemotes.length} static remotes...`);
  await new Promise<void>((res) => {
    const staticProcess = fork(
      nxBin,
      [
        'run-many',
        `--target=build`,
        `--projects=${remotes.staticRemotes.join(',')}`,
        ...(context.configurationName
          ? [`--configuration=${context.configurationName}`]
          : []),
        ...(options.parallel ? [`--parallel=${options.parallel}`] : []),
      ],
      {
        cwd: context.root,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(`NX Built ${remotes.staticRemotes.length} static remotes`);
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.on('exit', (code) => {
      if (code !== 0) {
        throw new Error(`Remote failed to start. See above for errors.`);
      }
    });
    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  });

  let isCollectingStaticRemoteOutput = true;
  const devRemoteIters: AsyncIterable<{ success: boolean }>[] = [];

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
        if (!options.isInitialHost) {
          done();
          return;
        }
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

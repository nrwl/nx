import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readCachedProjectGraph,
  runExecutor,
} from '@nrwl/devkit';
import { calculateProjectDependencies } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { ChildProcess, fork } from 'child_process';
import * as treeKill from 'tree-kill';
import { promisify } from 'util';
import { InspectType, NodeExecutorOptions } from './schema';

export interface ExecutorEvent {
  outfile: string;
  success: boolean;
}

export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  let subProcessRef: { ref: ChildProcess } = {
    ref: null,
  };

  process.on('SIGTERM', async () => {
    await killCurrentProcess(subProcessRef.ref);
    process.exit(128 + 15);
  });
  process.on('SIGINT', async () => {
    await killCurrentProcess(subProcessRef.ref);
    process.exit(128 + 2);
  });
  process.on('SIGHUP', async () => {
    await killCurrentProcess(subProcessRef.ref);
    process.exit(128 + 1);
  });

  if (options.waitUntilTargets && options.waitUntilTargets.length > 0) {
    const results = await runWaitUntilTargets(options, context);
    for (const [i, result] of results.entries()) {
      if (!result.success) {
        throw new Error(
          `Wait until target failed: ${options.waitUntilTargets[i]}.`
        );
      }
    }
  }

  const mappings = calculateResolveMappings(context, options);
  for await (const event of startBuild(options, context)) {
    if (!event.success) {
      logger.error('There was an error with the build. See above.');
      logger.info(`${event.outfile} was not restarted.`);
    }
    await handleBuildEvent(event, options, mappings, subProcessRef);
    yield event;
  }
}

function calculateResolveMappings(
  context: ExecutorContext,
  options: NodeExecutorOptions
) {
  const projectGraph = readCachedProjectGraph();
  const parsed = parseTargetString(options.buildTarget);
  const { dependencies } = calculateProjectDependencies(
    projectGraph,
    context.root,
    parsed.project,
    parsed.target,
    parsed.configuration
  );
  return dependencies.reduce((m, c) => {
    if (c.node.type !== 'npm' && c.outputs[0] != null) {
      m[c.name] = joinPathFragments(context.root, c.outputs[0]);
    }
    return m;
  }, {});
}

async function runProcess(
  event: ExecutorEvent,
  options: NodeExecutorOptions,
  mappings: { [project: string]: string }
) {
  const subProcess = fork(
    joinPathFragments(__dirname, 'node-with-require-overrides'),
    options.args,
    {
      execArgv: getExecArgv(options),
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_FILE_TO_RUN: event.outfile,
        NX_MAPPINGS: JSON.stringify(mappings),
      },
    }
  );

  if (!options.watch) {
    return new Promise<void>((resolve, reject) => {
      subProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject();
        }
      });
    });
  }

  return subProcess;
}

function getExecArgv(options: NodeExecutorOptions) {
  const args = [
    '-r',
    require.resolve('source-map-support/register'),
    ...options.runtimeArgs,
  ];

  if (options.inspect === true) {
    options.inspect = InspectType.Inspect;
  }

  if (options.inspect) {
    args.push(`--${options.inspect}=${options.host}:${options.port}`);
  }

  return args;
}

async function handleBuildEvent(
  event: ExecutorEvent,
  options: NodeExecutorOptions,
  mappings: { [project: string]: string },
  subProcessRef: { ref: ChildProcess | null }
) {
  // Don't kill previous run unless new build is successful.
  if (options.watch && event.success) {
    await killCurrentProcess(subProcessRef.ref);
  }

  if (event.success) {
    const subProcess = await runProcess(event, options, mappings);
    if (subProcess) {
      subProcessRef.ref = subProcess;
    }
  }
}

const promisifiedTreeKill: (pid: number, signal: string) => Promise<void> =
  promisify(treeKill);

async function killCurrentProcess(subProcess: ChildProcess | null) {
  if (!subProcess) return;

  try {
    await promisifiedTreeKill(subProcess.pid, 'SIGTERM');
  } catch (err) {
    if (Array.isArray(err) && err[0] && err[2]) {
      const errorMessage = err[2];
      logger.error(errorMessage);
    } else if (err.message) {
      logger.error(err.message);
    }
  } finally {
    subProcess = null;
  }
}

async function* startBuild(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  const buildTarget = parseTargetString(options.buildTarget);

  // TODO(jack): [Nx 14] Remove this line once we generate `development` configuration by default + add migration for it if missing
  buildTarget.configuration ??= '';

  yield* await runExecutor<ExecutorEvent>(
    buildTarget,
    {
      ...options.buildTargetOptions,
      watch: options.watch,
    },
    context
  );
}

function runWaitUntilTargets(
  options: NodeExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }[]> {
  return Promise.all(
    options.waitUntilTargets.map(async (waitUntilTarget) => {
      const target = parseTargetString(waitUntilTarget);
      const output = await runExecutor(target, {}, context);
      return new Promise<{ success: boolean }>(async (resolve) => {
        let event = await output.next();
        // Resolve after first event
        resolve(event.value as { success: boolean });

        // Continue iterating
        while (!event.done) {
          event = await output.next();
        }
      });
    })
  );
}

export default nodeExecutor;

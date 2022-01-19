import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  runExecutor,
} from '@nrwl/devkit';
import { ChildProcess, fork } from 'child_process';
import * as treeKill from 'tree-kill';
import { promisify } from 'util';
import { ExecutorEvent } from '../../utils/schema';
import { InspectType, NodeExecutorOptions } from './schema';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { calculateProjectDependencies } from '@nrwl/workspace/src/utilities/buildable-libs-utils';

let subProcess: ChildProcess = null;

export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  process.on('SIGTERM', async () => {
    await killProcess();
    process.exit(128 + 15);
  });
  process.on('SIGINT', async () => {
    await killProcess();
    process.exit(128 + 2);
  });
  process.on('SIGHUP', async () => {
    await killProcess();
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
    await handleBuildEvent(event, options, mappings);
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
    if (!c.outputs[0] && c.node.type === 'npm') {
      c.outputs[0] = `node_modules/${c.node.data.packageName}`;
    }
    m[c.name] = joinPathFragments(context.root, c.outputs[0]);
    return m;
  }, {});
}

function runProcess(
  event: ExecutorEvent,
  options: NodeExecutorOptions,
  mappings: { [project: string]: string }
) {
  subProcess = fork(
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
  mappings: { [project: string]: string }
) {
  if ((!event.success || options.watch) && subProcess) {
    await killProcess();
  }
  if (event.success) {
    runProcess(event, options, mappings);
  }
}

async function killProcess() {
  const promisifiedTreeKill: (pid: number, signal: string) => Promise<void> =
    promisify(treeKill);
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

import 'dotenv/config';
import {
  runExecutor,
  stripIndents,
  parseTargetString,
  ExecutorContext,
  logger,
  readTargetOptions,
} from '@nrwl/devkit';

import { ChildProcess, fork } from 'child_process';
import { promisify } from 'util';
import * as treeKill from 'tree-kill';

import { NodeBuildEvent } from '../build/build.impl';
import { BuildNodeBuilderOptions } from '../../utils/types';

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
}

export interface NodeExecuteBuilderOptions {
  inspect: boolean | InspectType;
  runtimeArgs: string[];
  args: string[];
  waitUntilTargets: string[];
  buildTarget: string;
  buildTargetOptions: Record<string, any>;
  host: string;
  port: number;
  watch: boolean;
}

let subProcess: ChildProcess = null;

export async function* executeExecutor(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  process.on('SIGTERM', () => {
    subProcess?.kill();
    process.exit(128 + 15);
  });
  process.on('exit', (code) => {
    process.exit(code);
  });

  if (options.waitUntilTargets && options.waitUntilTargets.length > 0) {
    const results = await runWaitUntilTargets(options, context);
    for (const [i, result] of results.entries()) {
      if (!result.success) {
        console.log('throw');
        throw new Error(
          `Wait until target failed: ${options.waitUntilTargets[i]}.`
        );
      }
    }
  }

  for await (const event of startBuild(options, context)) {
    if (!event.success) {
      logger.error('There was an error with the build. See above.');
      logger.info(`${event.outfile} was not restarted.`);
    }
    await handleBuildEvent(event, options);
    yield event;
  }
}

function runProcess(event: NodeBuildEvent, options: NodeExecuteBuilderOptions) {
  if (subProcess || !event.success) {
    return;
  }

  subProcess = fork(event.outfile, options.args, {
    execArgv: getExecArgv(options),
  });
}

function getExecArgv(options: NodeExecuteBuilderOptions) {
  const args = ['-r', 'source-map-support/register', ...options.runtimeArgs];

  if (options.inspect === true) {
    options.inspect = InspectType.Inspect;
  }

  if (options.inspect) {
    args.push(`--${options.inspect}=${options.host}:${options.port}`);
  }

  return args;
}

async function handleBuildEvent(
  event: NodeBuildEvent,
  options: NodeExecuteBuilderOptions
) {
  if ((!event.success || options.watch) && subProcess) {
    await killProcess();
  }
  runProcess(event, options);
}

async function killProcess() {
  if (!subProcess) {
    return;
  }

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
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  const buildTarget = parseTargetString(options.buildTarget);
  const buildOptions = readTargetOptions<BuildNodeBuilderOptions>(
    buildTarget,
    context
  );
  if (buildOptions.optimization) {
    logger.warn(stripIndents`
            ************************************************
            This is a simple process manager for use in
            testing or debugging Node applications locally.
            DO NOT USE IT FOR PRODUCTION!
            You should look into proper means of deploying
            your node application to production.
            ************************************************`);
  }

  yield* await runExecutor<NodeBuildEvent>(
    buildTarget,
    {
      ...options.buildTargetOptions,
      watch: options.watch,
    },
    context
  );
}

function runWaitUntilTargets(
  options: NodeExecuteBuilderOptions,
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

export default executeExecutor;

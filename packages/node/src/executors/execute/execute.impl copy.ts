import 'dotenv/config';
import {
  runExecutor,
  stripIndents,
  parseTargetString,
  ExecutorContext,
  logger,
  readTargetOptions,
} from '@nrwl/devkit';

import { ChildProcess, fork, Serializable } from 'child_process';
import { promisify } from 'util';
import * as treeKill from 'tree-kill';

import { NodeBuildEvent } from '../build/build.impl';
import { BuildNodeBuilderOptions } from '../../utils/types';
import { merge } from 'rxjs';

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
  host: string;
  port: number;
  watch: boolean;
}

let subProcess: ChildProcess = null;

type RunEvent = {
  success: boolean;
  type: 'exit' | 'message' | 'error';
  message?: Serializable | Error; // TODO: probably ont what we want
  done: boolean;
};

type ProcessRunner = {
  handleBuildEvent(event: NodeBuildEvent): Promise<void>;
  // setProcess: (proc: ChildProcess) => void;
  events: AsyncIterable<RunEvent>;
};

const createProcessRunner = (
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
): ProcessRunner => {
  let proc: ChildProcess;
  let eventQueue: RunEvent[] = [];

  const emit = (e: RunEvent) => eventQueue.push(e);

  // how do we trigger event from here without doing something like racing a deferred?

  return {
    handleBuildEvent: async (buildEvent: NodeBuildEvent) => {
      if ((!buildEvent.success || options.watch) && process) {
        await killProcess();
      }
      proc = fork(buildEvent.outfile, options.args, {
        execArgv: getExecArgv(options),
      });

      proc.on('exit', (code) => {
        emit({ success: true, type: 'exit', done: !options.watch });
      });
      proc.on('message', (message) => {
        emit({ success: true, type: 'message', message, done: false });
      });
      proc.on('error', (error) => {
        emit({
          success: true,
          type: 'error',
          message: error,
          done: !options.watch,
        });
      });
    },
    events: {
      [Symbol.asyncIterator]: async function* () {
        while ((nextEvent = await getNextEvent())) {
          if (nextEvent == 'doneSignal') {
            break;
          }
          yield nextEvent;
        }
        // while(true){
        //   if(eventQueue.length){
        //     yield Promise.resolve(eventQueue.pop())
        //   }
        // }
      },
    },
  };
};

async function* buildAndKillProcess(
  processRunner: ProcessRunner,
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  for await (const event of startBuild(options, context)) {
    processRunner.handleBuildEvent(event);

    yield event;
  }
}

export async function* executeExecutor2(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  const processRunner = createProcessRunner(options, context);

  for await (const event of buildAndKillProcess(
    processRunner,
    options,
    context
  )) {
    if (!event.success) {
      logger.error('There was an error with the build. See above.');
      logger.info(`${event.outfile} was not restarted.`);
    }
    yield event;
    // yield * runProcess();
    // await processRunner.handleBuildEvent(event)
    yield* processRunner.events;
  }
}

async function* createBuildIterator(
  procRunner: ProcessRunner,
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  for await (const event of startBuild(options, context)) {
    if (!event.success) {
      logger.error('There was an error with the build. See above.');
      logger.info(`${event.outfile} was not restarted.`);
    } else {
      yield procRunner.handleBuildEvent(event);
    }
  }
}

export async function* executeExecutor(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  /**
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
   * 
   */

  // Psuedo-code:
  // merge(startBuildIterator, runProcess)
  // const processRunner = createProcessRunner();
  // const buildRunner = createBuildIterator(processRunner, options, context);
  // yield* mergeIterators(processRunner.events, buildRunner);

  // Promise race or merge with startBuild and build event?
  for await (const event of startBuild(options, context)) {
    if (!event.success) {
      logger.error('There was an error with the build. See above.');
      logger.info(`${event.outfile} was not restarted.`);
    }
    yield event;
    // yield * runProcess();
    yield await handleBuildEvent(event, options);
  }
}

async function runProcess(
  event: NodeBuildEvent,
  options: NodeExecuteBuilderOptions
) {
  if (subProcess || !event.success) {
    return;
  }

  subProcess = fork(event.outfile, options.args, {
    execArgv: getExecArgv(options),
  });

  if (!options.watch) {
    await new Promise((resolve, reject) => {
      subProcess.on('exit', resolve);
      subProcess.on('error', reject);
      subProcess.on('message' /* what do? */);
    });
  }
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
  try {
    await runProcess(event, options);
    return { success: true };
  } catch {
    return { success: false };
  }
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

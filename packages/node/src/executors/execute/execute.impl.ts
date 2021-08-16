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
  host: string;
  port: number;
  watch: boolean;
}

let subProcess: ChildProcess = null;
/**
 * Ensure subprocess is cleaned up when parent process exits as a result of
 * process.exit() rather than from a signal (like from <ctrl-c>).
 *
 * When the process is killed by a signal, that signal is forwarded to any
 * forked processes ensuring the children are also shut down. But with
 * process.exit() there is no signal to forward so the forked process is
 * left running.
 *
 * This currently happens in our testcafe builder where we start the server
 * using the execute builder and then run our tests against that server. At
 * the end of the test run, we complete the builder observable using `take(1)`,
 * resulting in the Nx cli calling `process.exit(builderOutput.succes ? 0 : 1)`
 * orphaning our server process.
 *
 * NOTE: We can't use treeKill(subProcess.pid, 'SIGTERM') because it performs
 *       async operations which are disallowed in  the `exit` event.
 */
process.on('exit', () => {
  if (subProcess) {
    subProcess.kill('SIGTERM');
    subProcess = null;
  }
});
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
    const subProcessMessage = await getSubProcessURL();
    yield { ...event, subProcessMessage };
  }
}

async function getSubProcessURL() {
  return new Promise((resolve) => {
    subProcess.on('message', (message) => resolve(message));
  });
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

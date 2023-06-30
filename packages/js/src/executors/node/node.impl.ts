import * as chalk from 'chalk';
import { ChildProcess, exec, fork } from 'child_process';
import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  runExecutor,
} from '@nx/devkit';
import { daemonClient } from 'nx/src/daemon/client/client';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { join } from 'path';

import { InspectType, NodeExecutorOptions } from './schema';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { calculateProjectDependencies } from '../../utils/buildable-libs-utils';
import { killTree } from './lib/kill-tree';
import { fileExists } from 'nx/src/utils/fileutils';

interface ActiveTask {
  id: string;
  killed: boolean;
  promise: Promise<void>;
  childProcess: null | ChildProcess;
  start: () => Promise<void>;
  stop: (signal: NodeJS.Signals) => Promise<void>;
}

function debounce(fn: () => void, wait: number) {
  let timeoutId: NodeJS.Timeout;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fn, wait);
  };
}

export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= context?.configurationName ?? 'development';
  const project = context.projectGraph.nodes[context.projectName];
  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph
  );

  let buildOptions: Record<string, any>;
  if (project.data.targets[buildTarget.target]) {
    buildOptions = {
      ...project.data.targets[buildTarget.target]?.options,
      ...options.buildTargetOptions,
    };
  } else {
    throw new Error(
      `Cannot find build target ${chalk.bold(
        options.buildTarget
      )} for project ${chalk.bold(context.projectName)}`
    );
  }

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

  // Re-map buildable workspace projects to their output directory.
  const mappings = calculateResolveMappings(context, options);
  let outputFileName =
    buildOptions.outputFileName || `${path.parse(buildOptions.main).name}.js`;

  if (!buildOptions.outputFileName) {
    const matches = buildOptions.main.match(/^(?!.*src)(.*)\/([^/]*)$/); //ignore strings that contain src and split paths into [folders before main, main.ts]
    if (matches) {
      const [mainFolder, mainFileName] = matches.slice(1);
      outputFileName = path.join(
        mainFolder,
        `${path.parse(mainFileName).name}.js`
      );
    }
  }

  const fileToRun = join(context.root, buildOptions.outputPath, outputFileName);
  const tasks: ActiveTask[] = [];
  let currentTask: ActiveTask = null;

  yield* createAsyncIterable<{
    success: boolean;
    options?: Record<string, any>;
  }>(async ({ done, next, error }) => {
    const processQueue = async () => {
      if (tasks.length === 0) return;

      const previousTask = currentTask;
      const task = tasks.shift();
      currentTask = task;
      await previousTask?.stop('SIGTERM');
      await task.start();
    };

    const debouncedProcessQueue = debounce(
      processQueue,
      options.debounce ?? 1_000
    );

    const addToQueue = async () => {
      const task: ActiveTask = {
        id: randomUUID(),
        killed: false,
        childProcess: null,
        promise: null,
        start: async () => {
          let buildFailed = false;
          // Run the build
          task.promise = new Promise<void>(async (resolve, reject) => {
            task.childProcess = exec(
              `npx nx run ${context.projectName}:${buildTarget.target}${
                buildTarget.configuration ? `:${buildTarget.configuration}` : ''
              }`,
              {
                cwd: context.root,
              },
              (error, stdout, stderr) => {
                if (
                  // Build succeeded
                  !error ||
                  // If task was killed then another build process has started, ignore errors.
                  task.killed
                ) {
                  resolve();
                  return;
                }

                logger.info(stdout);
                buildFailed = true;
                if (options.watch) {
                  logger.error(
                    `Build failed, waiting for changes to restart...`
                  );
                  resolve(); // Don't reject because it'll error out and kill the Nx process.
                } else {
                  logger.error(`Build failed. See above for errors.`);
                  reject();
                }
              }
            );
          });

          // Wait for build to finish
          await task.promise;

          // Task may have been stopped due to another running task.
          // OR build failed, so don't start the process.
          if (task.killed || buildFailed) return;

          // Run the program
          task.promise = new Promise<void>((resolve, reject) => {
            task.childProcess = fork(
              joinPathFragments(__dirname, 'node-with-require-overrides'),
              options.args ?? [],
              {
                execArgv: getExecArgv(options),
                stdio: [0, 1, 'pipe', 'ipc'],
                env: {
                  ...process.env,
                  NX_FILE_TO_RUN: fileToRunCorrectPath(fileToRun),
                  NX_MAPPINGS: JSON.stringify(mappings),
                },
              }
            );

            task.childProcess.stderr.on('data', (data) => {
              // Don't log out error if task is killed and new one has started.
              // This could happen if a new build is triggered while new process is starting, since the operation is not atomic.
              // Log the error in normal mode
              if (!options.watch || !task.killed) {
                logger.error(data.toString());
              }
            });

            task.childProcess.once('exit', (code) => {
              if (options.watch && !task.killed) {
                logger.info(
                  `NX Process exited with code ${code}, waiting for changes to restart...`
                );
              }
              if (!options.watch) done();
              resolve();
            });

            next({ success: true, options: buildOptions });
          });
        },
        stop: async (signal = 'SIGTERM') => {
          task.killed = true;
          // Request termination and wait for process to finish gracefully.
          // NOTE: `childProcess` may not have been set yet if the task did not have a chance to start.
          // e.g. multiple file change events in a short time (like git checkout).
          if (task.childProcess) {
            await killTree(task.childProcess.pid, signal);
          }
          await task.promise;
        },
      };

      tasks.push(task);
    };

    if (options.watch) {
      const stopWatch = await daemonClient.registerFileWatcher(
        {
          watchProjects: [context.projectName],
          includeDependentProjects: true,
        },
        async (err, data) => {
          if (err === 'closed') {
            logger.error(`Watch error: Daemon closed the connection`);
            process.exit(1);
          } else if (err) {
            logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
          } else {
            logger.info(`NX File change detected. Restarting...`);
            await addToQueue();
            await debouncedProcessQueue();
          }
        }
      );

      const stopAllTasks = (signal: NodeJS.Signals = 'SIGTERM') => {
        for (const task of tasks) {
          task.stop(signal);
        }
      };

      process.on('SIGTERM', async () => {
        stopWatch();
        stopAllTasks('SIGTERM');
        process.exit(128 + 15);
      });
      process.on('SIGINT', async () => {
        stopWatch();
        stopAllTasks('SIGINT');
        process.exit(128 + 2);
      });
      process.on('SIGHUP', async () => {
        stopWatch();
        stopAllTasks('SIGHUP');
        process.exit(128 + 1);
      });
    }

    await addToQueue();
    await processQueue();
  });
}

function getExecArgv(options: NodeExecutorOptions) {
  const args = (options.runtimeArgs ??= []);
  args.push('-r', require.resolve('source-map-support/register'));

  if (options.inspect === true) {
    options.inspect = InspectType.Inspect;
  }

  if (options.inspect) {
    args.push(`--${options.inspect}=${options.host}:${options.port}`);
  }

  return args;
}

function calculateResolveMappings(
  context: ExecutorContext,
  options: NodeExecutorOptions
) {
  const parsed = parseTargetString(options.buildTarget, context.projectGraph);
  const { dependencies } = calculateProjectDependencies(
    context.projectGraph,
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

function runWaitUntilTargets(
  options: NodeExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }[]> {
  return Promise.all(
    options.waitUntilTargets.map(async (waitUntilTarget) => {
      const target = parseTargetString(waitUntilTarget, context.projectGraph);
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

function fileToRunCorrectPath(fileToRun: string): string {
  if (!fileExists(fileToRun)) {
    const cjsFile = fileToRun.replace(/\.js$/, '.cjs');
    if (fileExists(cjsFile)) {
      fileToRun = cjsFile;
    } else {
      const mjsFile = fileToRun.replace(/\.js$/, '.mjs');
      if (fileExists(mjsFile)) {
        fileToRun = mjsFile;
      } else {
        throw new Error(
          `Could not find ${fileToRun}. Make sure your build succeeded.`
        );
      }
    }
  }
  return fileToRun;
}

export default nodeExecutor;

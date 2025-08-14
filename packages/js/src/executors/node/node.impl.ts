import * as chalk from 'chalk';
import { ChildProcess, fork } from 'child_process';
import {
  ExecutorContext,
  isDaemonEnabled,
  joinPathFragments,
  logger,
  parseTargetString,
  ProjectGraphProjectNode,
  readTargetOptions,
  runExecutor,
} from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { daemonClient } from 'nx/src/daemon/client/client';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { join } from 'path';

import { InspectType, NodeExecutorOptions } from './schema';
import { calculateProjectBuildableDependencies } from '../../utils/buildable-libs-utils';
import { killTree } from './lib/kill-tree';
import { LineAwareStream } from './lib/line-aware-stream';
import { createCoalescingDebounce } from './lib/coalescing-debounce';
import { fileExists } from 'nx/src/utils/fileutils';
import { getRelativeDirectoryToProjectRoot } from '../../utils/get-main-file-dir';
import { interpolate } from 'nx/src/tasks-runner/utils';
import { detectModuleFormat } from './lib/detect-module-format';

interface ActiveTask {
  id: string;
  killed: boolean;
  promise: Promise<{ success: boolean }>;
  childProcess: null | ChildProcess;
  cancellationToken: { cancelled: boolean };
  start: () => Promise<void>;
  stop: (signal: NodeJS.Signals) => Promise<void>;
}

const globalLineAwareStream = new LineAwareStream();

export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= context?.configurationName ?? 'development';
  const project = context.projectGraph.nodes[context.projectName];
  const buildTarget = parseTargetString(options.buildTarget, context);

  if (!project.data.targets[buildTarget.target]) {
    throw new Error(
      `Cannot find build target ${chalk.bold(
        options.buildTarget
      )} for project ${chalk.bold(context.projectName)}`
    );
  }

  const buildTargetExecutor =
    project.data.targets[buildTarget.target]?.executor;

  if (buildTargetExecutor === 'nx:run-commands') {
    // Run commands does not emit build event, so we have to switch to run entire build through Nx CLI.
    options.runBuildTargetDependencies = true;
  }

  const buildOptions: Record<string, any> = {
    ...readTargetOptions(buildTarget, context),
    ...options.buildTargetOptions,
    target: buildTarget.target,
  };

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
  const fileToRun = getFileToRun(
    context,
    project,
    buildOptions,
    buildTargetExecutor
  );

  // Detect module format for the project
  const moduleFormat = detectModuleFormat({
    projectRoot: project.data.root,
    workspaceRoot: context.root,
    tsConfig:
      buildOptions.tsConfig ||
      join(context.root, project.data.root, 'tsconfig.json'),
    main: buildOptions.main || fileToRun,
    buildOptions,
  });

  let additionalExitHandler: null | (() => void) = null;
  let currentTask: ActiveTask = null;
  const tasks: ActiveTask[] = [];

  yield* createAsyncIterable<{
    success: boolean;
    options?: Record<string, any>;
  }>(async ({ done, next, error, registerCleanup }) => {
    const processQueue = async () => {
      if (tasks.length === 0) return;

      const previousTask = currentTask;
      const task = tasks.shift();

      if (previousTask && !previousTask.killed) {
        previousTask.killed = true;

        if (previousTask.childProcess?.connected) {
          previousTask.childProcess.disconnect();
        }

        previousTask.childProcess?.removeAllListeners();

        await previousTask.stop('SIGTERM');

        await new Promise((resolve) => setImmediate(resolve));
      }

      currentTask = task;
      globalLineAwareStream.setActiveProcess(task.id);
      await task.start();
    };

    const debouncedProcessQueue = createCoalescingDebounce(
      processQueue,
      options.debounce ?? 1_000
    );

    const addToQueue = async (
      childProcess: null | ChildProcess,
      buildResult: Promise<{ success: boolean }>
    ) => {
      for (const task of tasks) {
        if (!task.killed) {
          task.cancellationToken.cancelled = true;
          await task.stop('SIGTERM');
        }
      }
      tasks.length = 0;

      const task: ActiveTask = {
        id: randomUUID(),
        killed: false,
        childProcess,
        cancellationToken: { cancelled: false },
        promise: null,
        start: async () => {
          // Wait for build to finish.
          const result = await buildResult;

          if (result && !result.success) {
            // If in watch-mode, don't throw or else the process exits.
            if (options.watch) {
              if (!task.killed) {
                // Only log build error if task was not killed by a new change.
                logger.error(`Build failed, waiting for changes to restart...`);
              }
              return;
            } else {
              throw new Error(`Build failed. See above for errors.`);
            }
          }

          if (task.killed || task.cancellationToken.cancelled) return;

          // Run the program
          task.promise = new Promise<{ success: boolean }>(
            (resolve, reject) => {
              const loaderFile =
                moduleFormat === 'esm'
                  ? 'node-with-esm-loader'
                  : 'node-with-require-overrides';

              task.childProcess = fork(
                joinPathFragments(__dirname, loaderFile),
                options.args ?? [],
                {
                  execArgv: getExecArgv(options),
                  stdio: [0, 'pipe', 'pipe', 'ipc'],
                  env: {
                    ...process.env,
                    NX_FILE_TO_RUN: fileToRunCorrectPath(fileToRun),
                    NX_MAPPINGS: JSON.stringify(mappings),
                  },
                }
              );

              task.childProcess.stdout?.on('data', (data) => {
                globalLineAwareStream.write(data, task.id);
              });

              const handleStdErr = (data) => {
                if (
                  !options.watch ||
                  (!task.killed && !task.cancellationToken.cancelled)
                ) {
                  if (task.id === globalLineAwareStream.currentProcessId) {
                    logger.error(data.toString());
                  }
                }
              };
              task.childProcess.stderr?.on('data', handleStdErr);
              task.childProcess.once('exit', (code) => {
                task.childProcess.off('data', handleStdErr);
                if (options.watch && !task.killed) {
                  logger.info(
                    `NX Process exited with code ${code}, waiting for changes to restart...`
                  );
                }
                if (!options.watch) {
                  if (code !== 0) {
                    error(new Error(`Process exited with code ${code}`));
                  } else {
                    resolve({ success: true });
                  }
                }
                resolve({ success: code === 0 });
              });

              next({ success: true, options: buildOptions });
            }
          );
        },
        stop: async (signal = 'SIGTERM') => {
          task.killed = true;
          task.cancellationToken.cancelled = true;

          if (task.childProcess) {
            if (task.childProcess.stdout) {
              task.childProcess.stdout.pause();
            }
            if (task.childProcess.stderr) {
              task.childProcess.stderr.pause();
            }

            if (task.childProcess.connected) {
              task.childProcess.disconnect();
            }

            task.childProcess.removeAllListeners();

            await killTree(task.childProcess.pid, signal);
          }

          if (task.id === globalLineAwareStream.currentProcessId) {
            globalLineAwareStream.setActiveProcess(null);
          }
        },
      };

      tasks.push(task);
    };

    const stopAllTasks = async (signal: NodeJS.Signals = 'SIGTERM') => {
      debouncedProcessQueue.cancel();

      globalLineAwareStream.flush();

      if (typeof additionalExitHandler === 'function') {
        additionalExitHandler();
      }

      if (typeof currentTask?.stop === 'function') {
        await currentTask.stop(signal);
      }

      for (const task of tasks) {
        await task.stop(signal);
      }
    };

    process.on('SIGTERM', async () => {
      await stopAllTasks('SIGTERM');
      process.exit(128 + 15);
    });
    process.on('SIGINT', async () => {
      await stopAllTasks('SIGINT');
      process.exit(128 + 2);
    });
    process.on('SIGHUP', async () => {
      await stopAllTasks('SIGHUP');
      process.exit(128 + 1);
    });

    registerCleanup(async () => {
      await stopAllTasks('SIGTERM');
    });

    if (options.runBuildTargetDependencies) {
      // If a all dependencies need to be rebuild on changes, then register with watcher
      // and run through CLI, otherwise only the current project will rebuild.
      const runBuild = async () => {
        let childProcess: ChildProcess = null;
        const whenReady = new Promise<{ success: boolean }>(async (resolve) => {
          childProcess = fork(
            require.resolve('nx'),
            [
              'run',
              `${context.projectName}:${buildTarget.target}${
                buildTarget.configuration ? `:${buildTarget.configuration}` : ''
              }`,
            ],
            {
              cwd: context.root,
              stdio: 'inherit',
            }
          );
          childProcess.once('exit', (code) => {
            if (code === 0) resolve({ success: true });
            // If process is killed due to current task being killed, then resolve with success.
            else resolve({ success: !!currentTask?.killed });
          });
        });
        await addToQueue(childProcess, whenReady);
        await debouncedProcessQueue.trigger();
      };
      if (isDaemonEnabled()) {
        additionalExitHandler = await daemonClient.registerFileWatcher(
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
              if (options.watch) {
                logger.info(`NX File change detected. Restarting...`);
                await runBuild();
              }
            }
          }
        );
      } else {
        logger.warn(
          `NX Daemon is not running. Node process will not restart automatically after file changes.`
        );
      }
      await runBuild(); // run first build
    } else {
      // Otherwise, run the build executor, which will not run task dependencies.
      // This is mostly fine for bundlers like webpack that should already watch for dependency libs.
      // For tsc/swc or custom build commands, consider using `runBuildTargetDependencies` instead.
      const output = await runExecutor(
        buildTarget,
        {
          ...options.buildTargetOptions,
          watch: options.watch,
        },
        context
      );
      while (true) {
        const event = await output.next();
        await addToQueue(null, Promise.resolve(event.value));
        await debouncedProcessQueue.trigger();
        if (event.done || !options.watch) {
          break;
        }
      }
    }
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
  const parsed = parseTargetString(options.buildTarget, context);
  const { dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
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
      const target = parseTargetString(waitUntilTarget, context);
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

function getFileToRun(
  context: ExecutorContext,
  project: ProjectGraphProjectNode,
  buildOptions: Record<string, any>,
  buildTargetExecutor: string
): string {
  // If using run-commands or another custom executor, then user should set
  // outputFileName, but we can try the default value that we use.
  if (!buildOptions?.outputPath && !buildOptions?.outputFileName) {
    // If we are using crystal for infering the target, we can use the output path from the target.
    // Since the output path has a token for the project name, we need to interpolate it.
    // {workspaceRoot}/dist/{projectRoot} -> dist/my-app
    const outputPath = project.data.targets[buildOptions.target]?.outputs?.[0];

    if (outputPath) {
      const outputFilePath = interpolate(outputPath, {
        projectName: project.name,
        projectRoot: project.data.root,
        workspaceRoot: context.root,
      });
      return path.join(outputFilePath, 'main.js');
    }
    const fallbackFile = path.join('dist', project.data.root, 'main.js');

    logger.warn(
      `Build option ${chalk.bold('outputFileName')} not set for ${chalk.bold(
        project.name
      )}. Using fallback value of ${chalk.bold(fallbackFile)}.`
    );
    return join(context.root, fallbackFile);
  }

  let outputFileName = buildOptions.outputFileName;

  if (!outputFileName) {
    const fileName = `${path.parse(buildOptions.main).name}.js`;
    if (
      buildTargetExecutor === '@nx/js:tsc' ||
      buildTargetExecutor === '@nx/js:swc'
    ) {
      outputFileName = path.join(
        getRelativeDirectoryToProjectRoot(buildOptions.main, project.data.root),
        fileName
      );
    } else {
      outputFileName = fileName;
    }
  }

  return join(context.root, buildOptions.outputPath, outputFileName);
}

function fileToRunCorrectPath(fileToRun: string): string {
  if (fileExists(fileToRun)) return fileToRun;

  const extensionsToTry = ['.cjs', '.mjs', '.cjs.js', '.esm.js'];

  for (const ext of extensionsToTry) {
    const file = fileToRun.replace(/\.js$/, ext);
    if (fileExists(file)) return file;
  }

  throw new Error(
    `Could not find ${fileToRun}. Make sure your build succeeded.`
  );
}

export default nodeExecutor;

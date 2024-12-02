import { prompt } from 'enquirer';
import * as ora from 'ora';
import { join } from 'path';
import {
  NxJsonConfiguration,
  readNxJson,
  TargetDependencies,
} from '../config/nx-json';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { createTaskHasher } from '../hasher/create-task-hasher';
import {
  getTaskDetails,
  hashTasksThatDoNotDependOnOutputsOfOtherTasks,
} from '../hasher/hash-task';
import { IS_WASM } from '../native';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { NxArgs } from '../utils/command-line-utils';
import { isRelativePath } from '../utils/fileutils';
import { isCI } from '../utils/is-ci';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { output } from '../utils/output';
import { handleErrors } from '../utils/handle-errors';
import {
  collectEnabledTaskSyncGeneratorsFromTaskGraph,
  flushSyncGeneratorChanges,
  getFailedSyncGeneratorsFixMessageLines,
  getFlushFailureMessageLines,
  getSyncGeneratorChanges,
  getSyncGeneratorSuccessResultsMessageLines,
  processSyncGeneratorResultErrors,
} from '../utils/sync-generators';
import { workspaceRoot } from '../utils/workspace-root';
import { createTaskGraph } from './create-task-graph';
import { CompositeLifeCycle, LifeCycle, TaskResult } from './life-cycle';
import { createRunManyDynamicOutputRenderer } from './life-cycles/dynamic-run-many-terminal-output-life-cycle';
import { createRunOneDynamicOutputRenderer } from './life-cycles/dynamic-run-one-terminal-output-life-cycle';
import { StaticRunManyTerminalOutputLifeCycle } from './life-cycles/static-run-many-terminal-output-life-cycle';
import { StaticRunOneTerminalOutputLifeCycle } from './life-cycles/static-run-one-terminal-output-life-cycle';
import { StoreRunInformationLifeCycle } from './life-cycles/store-run-information-life-cycle';
import { TaskHistoryLifeCycle } from './life-cycles/task-history-life-cycle';
import { LegacyTaskHistoryLifeCycle } from './life-cycles/task-history-life-cycle-old';
import { TaskProfilingLifeCycle } from './life-cycles/task-profiling-life-cycle';
import { TaskTimingsLifeCycle } from './life-cycles/task-timings-life-cycle';
import { TaskResultsLifeCycle } from './life-cycles/task-results-life-cycle';
import {
  findCycle,
  makeAcyclic,
  validateNoAtomizedTasks,
} from './task-graph-utils';
import { TasksRunner, TaskStatus } from './tasks-runner';
import { shouldStreamOutput } from './utils';
import chalk = require('chalk');
import type { Observable } from 'rxjs';
import { printPowerpackLicense } from '../utils/powerpack';

async function getTerminalOutputLifeCycle(
  initiatingProject: string,
  projectNames: string[],
  tasks: Task[],
  nxArgs: NxArgs,
  nxJson: NxJsonConfiguration,
  overrides: Record<string, unknown>
): Promise<{ lifeCycle: LifeCycle; renderIsDone: Promise<void> }> {
  const { runnerOptions } = getRunner(nxArgs, nxJson);
  const isRunOne = initiatingProject != null;
  const useDynamicOutput = shouldUseDynamicLifeCycle(
    tasks,
    runnerOptions,
    nxArgs.outputStyle
  );

  const overridesWithoutHidden = { ...overrides };
  delete overridesWithoutHidden['__overrides_unparsed__'];

  if (isRunOne) {
    if (useDynamicOutput) {
      return await createRunOneDynamicOutputRenderer({
        initiatingProject,
        tasks,
        args: nxArgs,
        overrides: overridesWithoutHidden,
      });
    }
    return {
      lifeCycle: new StaticRunOneTerminalOutputLifeCycle(
        initiatingProject,
        projectNames,
        tasks,
        nxArgs
      ),
      renderIsDone: Promise.resolve(),
    };
  } else {
    if (useDynamicOutput) {
      return await createRunManyDynamicOutputRenderer({
        projectNames,
        tasks,
        args: nxArgs,
        overrides: overridesWithoutHidden,
      });
    } else {
      return {
        lifeCycle: new StaticRunManyTerminalOutputLifeCycle(
          projectNames,
          tasks,
          nxArgs,
          overridesWithoutHidden
        ),
        renderIsDone: Promise.resolve(),
      };
    }
  }
}

function createTaskGraphAndRunValidations(
  projectGraph: ProjectGraph,
  extraTargetDependencies: TargetDependencies,
  projectNames: string[],
  nxArgs: NxArgs,
  overrides: any,
  extraOptions: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
) {
  const taskGraph = createTaskGraph(
    projectGraph,
    extraTargetDependencies,
    projectNames,
    nxArgs.targets,
    nxArgs.configuration,
    overrides,
    extraOptions.excludeTaskDependencies
  );

  const cycle = findCycle(taskGraph);
  if (cycle) {
    if (process.env.NX_IGNORE_CYCLES === 'true' || nxArgs.nxIgnoreCycles) {
      output.warn({
        title: `The task graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      makeAcyclic(taskGraph);
    } else {
      output.error({
        title: `Could not execute command because the task graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      process.exit(1);
    }
  }

  // validate that no atomized tasks like e2e-ci are used without Nx Cloud
  if (
    !isNxCloudUsed(readNxJson()) &&
    !process.env['NX_SKIP_ATOMIZER_VALIDATION']
  ) {
    validateNoAtomizedTasks(taskGraph, projectGraph);
  }

  return taskGraph;
}

export async function runCommand(
  projectsToRun: ProjectGraphProjectNode[],
  currentProjectGraph: ProjectGraph,
  { nxJson }: { nxJson: NxJsonConfiguration },
  nxArgs: NxArgs,
  overrides: any,
  initiatingProject: string | null,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  extraOptions: { excludeTaskDependencies: boolean; loadDotEnvFiles: boolean }
): Promise<NodeJS.Process['exitCode']> {
  const status = await handleErrors(
    process.env.NX_VERBOSE_LOGGING === 'true',
    async () => {
      const taskResults = await runCommandForTasks(
        projectsToRun,
        currentProjectGraph,
        { nxJson },
        nxArgs,
        overrides,
        initiatingProject,
        extraTargetDependencies,
        extraOptions
      );

      return Object.values(taskResults).some(
        (taskResult) =>
          taskResult.status === 'failure' || taskResult.status === 'skipped'
      )
        ? 1
        : 0;
    }
  );

  return status;
}

export async function runCommandForTasks(
  projectsToRun: ProjectGraphProjectNode[],
  currentProjectGraph: ProjectGraph,
  { nxJson }: { nxJson: NxJsonConfiguration },
  nxArgs: NxArgs,
  overrides: any,
  initiatingProject: string | null,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  extraOptions: { excludeTaskDependencies: boolean; loadDotEnvFiles: boolean }
): Promise<{ [id: string]: TaskResult }> {
  const projectNames = projectsToRun.map((t) => t.name);

  const { projectGraph, taskGraph } = await ensureWorkspaceIsInSyncAndGetGraphs(
    currentProjectGraph,
    nxJson,
    projectNames,
    nxArgs,
    overrides,
    extraTargetDependencies,
    extraOptions
  );
  const tasks = Object.values(taskGraph.tasks);

  const { lifeCycle, renderIsDone } = await getTerminalOutputLifeCycle(
    initiatingProject,
    projectNames,
    tasks,
    nxArgs,
    nxJson,
    overrides
  );

  const taskResults = await invokeTasksRunner({
    tasks,
    projectGraph,
    taskGraph,
    lifeCycle,
    nxJson,
    nxArgs,
    loadDotEnvFiles: extraOptions.loadDotEnvFiles,
    initiatingProject,
  });

  await renderIsDone;

  await printPowerpackLicense();

  return taskResults;
}

async function ensureWorkspaceIsInSyncAndGetGraphs(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  projectNames: string[],
  nxArgs: NxArgs,
  overrides: any,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  extraOptions: { excludeTaskDependencies: boolean; loadDotEnvFiles: boolean }
): Promise<{
  projectGraph: ProjectGraph;
  taskGraph: TaskGraph;
}> {
  let taskGraph = createTaskGraphAndRunValidations(
    projectGraph,
    extraTargetDependencies ?? {},
    projectNames,
    nxArgs,
    overrides,
    extraOptions
  );

  if (nxArgs.skipSync) {
    return { projectGraph, taskGraph };
  }

  // collect unique syncGenerators from the tasks
  const uniqueSyncGenerators = collectEnabledTaskSyncGeneratorsFromTaskGraph(
    taskGraph,
    projectGraph,
    nxJson
  );

  if (!uniqueSyncGenerators.size) {
    // There are no sync generators registered in the tasks to run
    return { projectGraph, taskGraph };
  }

  const syncGenerators = Array.from(uniqueSyncGenerators);
  const results = await getSyncGeneratorChanges(syncGenerators);
  if (!results.length) {
    // There are no changes to sync, workspace is up to date
    return { projectGraph, taskGraph };
  }

  const {
    failedGeneratorsCount,
    areAllResultsFailures,
    anySyncGeneratorsFailed,
  } = processSyncGeneratorResultErrors(results);
  const failedSyncGeneratorsFixMessageLines =
    getFailedSyncGeneratorsFixMessageLines(results, nxArgs.verbose);
  const outOfSyncTitle = 'The workspace is out of sync';
  const resultBodyLines = getSyncGeneratorSuccessResultsMessageLines(results);
  const fixMessage =
    'Make sure to run `nx sync` to apply the identified changes or set `sync.applyChanges` to `true` in your `nx.json` to apply them automatically when running tasks in interactive environments.';
  const willErrorOnCiMessage = 'This will result in an error in CI.';

  if (isCI() || !process.stdout.isTTY) {
    // If the user is running in CI or is running in a non-TTY environment we
    // throw an error to stop the execution of the tasks.
    if (areAllResultsFailures) {
      output.error({
        title: `The workspace is probably out of sync because ${
          failedGeneratorsCount === 1
            ? 'a sync generator'
            : 'some sync generators'
        } failed to run`,
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });
    } else {
      output.error({
        title: outOfSyncTitle,
        bodyLines: [...resultBodyLines, '', fixMessage],
      });

      if (anySyncGeneratorsFailed) {
        output.error({
          title:
            failedGeneratorsCount === 1
              ? 'A sync generator failed to run'
              : 'Some sync generators failed to run',
          bodyLines: failedSyncGeneratorsFixMessageLines,
        });
      }
    }

    process.exit(1);
  }

  if (areAllResultsFailures) {
    output.warn({
      title: `The workspace is probably out of sync because ${
        failedGeneratorsCount === 1
          ? 'a sync generator'
          : 'some sync generators'
      } failed to run`,
      bodyLines: failedSyncGeneratorsFixMessageLines,
    });

    await confirmRunningTasksWithSyncFailures();

    // if all sync generators failed to run there's nothing to sync, we just let the tasks run
    return { projectGraph, taskGraph };
  }

  if (nxJson.sync?.applyChanges === false) {
    // If the user has set `sync.applyChanges` to `false` in their `nx.json`
    // we don't prompt the them and just log a warning informing them that
    // the workspace is out of sync and they have it set to not apply changes
    // automatically.
    output.warn({
      title: outOfSyncTitle,
      bodyLines: [
        ...resultBodyLines,
        '',
        'Your workspace is set to not apply the identified changes automatically (`sync.applyChanges` is set to `false` in your `nx.json`).',
        willErrorOnCiMessage,
        fixMessage,
      ],
    });

    if (anySyncGeneratorsFailed) {
      output.warn({
        title:
          failedGeneratorsCount === 1
            ? 'A sync generator failed to run'
            : 'Some sync generators failed to run',
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });

      await confirmRunningTasksWithSyncFailures();
    }

    return { projectGraph, taskGraph };
  }

  output.warn({
    title: outOfSyncTitle,
    bodyLines: [
      ...resultBodyLines,
      '',
      nxJson.sync?.applyChanges === true
        ? 'Proceeding to sync the identified changes automatically (`sync.applyChanges` is set to `true` in your `nx.json`).'
        : willErrorOnCiMessage,
    ],
  });

  const applyChanges =
    nxJson.sync?.applyChanges === true ||
    (await promptForApplyingSyncGeneratorChanges());

  if (applyChanges) {
    const spinner = ora('Syncing the workspace...');
    spinner.start();

    // Flush sync generator changes to disk
    const flushResult = await flushSyncGeneratorChanges(results);

    if ('generatorFailures' in flushResult) {
      spinner.fail();
      output.error({
        title: 'Failed to sync the workspace',
        bodyLines: [
          ...getFlushFailureMessageLines(flushResult, nxArgs.verbose),
          ...(flushResult.generalFailure
            ? [
                'If needed, you can run the tasks with the `--skip-sync` flag to disable syncing.',
              ]
            : []),
        ],
      });

      await confirmRunningTasksWithSyncFailures();
    }

    // Re-create project graph and task graph
    projectGraph = await createProjectGraphAsync();
    taskGraph = createTaskGraphAndRunValidations(
      projectGraph,
      extraTargetDependencies ?? {},
      projectNames,
      nxArgs,
      overrides,
      extraOptions
    );

    const successTitle = anySyncGeneratorsFailed
      ? // the identified changes were synced successfully, but the workspace
        // is still not up to date, which we'll mention next
        'The identified changes were synced successfully!'
      : // the workspace is fully up to date
        'The workspace was synced successfully!';
    const successSubtitle =
      nxJson.sync?.applyChanges === true
        ? 'Please make sure to commit the changes to your repository or this will error in CI.'
        : // The user was prompted and we already logged a message about erroring in CI
          // so here we just tell them to commit the changes.
          'Please make sure to commit the changes to your repository.';
    spinner.succeed(`${successTitle}\n\n${successSubtitle}`);

    if (anySyncGeneratorsFailed) {
      output.warn({
        title: `The workspace is probably still out of sync because ${
          failedGeneratorsCount === 1
            ? 'a sync generator'
            : 'some sync generators'
        } failed to run`,
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });

      await confirmRunningTasksWithSyncFailures();
    }
  } else {
    if (anySyncGeneratorsFailed) {
      output.warn({
        title:
          failedGeneratorsCount === 1
            ? 'A sync generator failed to report the sync status'
            : 'Some sync generators failed to report the sync status',
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });

      await confirmRunningTasksWithSyncFailures();
    } else {
      output.warn({
        title: 'Syncing the workspace was skipped',
        bodyLines: [
          'This could lead to unexpected results or errors when running tasks.',
          fixMessage,
        ],
      });
    }
  }

  return { projectGraph, taskGraph };
}

async function promptForApplyingSyncGeneratorChanges(): Promise<boolean> {
  try {
    const promptConfig = {
      name: 'applyChanges',
      type: 'autocomplete',
      message:
        'Would you like to sync the identified changes to get your workspace up to date?',
      choices: [
        {
          name: 'yes',
          message: 'Yes, sync the changes and run the tasks',
        },
        {
          name: 'no',
          message: 'No, run the tasks without syncing the changes',
        },
      ],
      footer: () =>
        chalk.dim(
          '\nYou can skip this prompt by setting the `sync.applyChanges` option to `true` in your `nx.json`.\nFor more information, refer to the docs: https://nx.dev/concepts/sync-generators.'
        ),
    };

    return await prompt<{ applyChanges: 'yes' | 'no' }>([promptConfig]).then(
      ({ applyChanges }) => applyChanges === 'yes'
    );
  } catch {
    process.exit(1);
  }
}

async function confirmRunningTasksWithSyncFailures(): Promise<void> {
  try {
    const promptConfig = {
      name: 'runTasks',
      type: 'autocomplete',
      message:
        'Would you like to ignore the sync failures and continue running the tasks?',
      choices: [
        {
          name: 'yes',
          message: 'Yes, ignore the failures and run the tasks',
        },
        {
          name: 'no',
          message: `No, don't run the tasks`,
        },
      ],
      footer: () =>
        chalk.dim(
          `\nWhen running in CI and there are sync failures, the tasks won't run. Addressing the errors above is highly recommended to prevent failures in CI.`
        ),
    };

    const runTasks = await prompt<{ runTasks: 'yes' | 'no' }>([
      promptConfig,
    ]).then(({ runTasks }) => runTasks === 'yes');

    if (!runTasks) {
      process.exit(1);
    }
  } catch {
    process.exit(1);
  }
}

function setEnvVarsBasedOnArgs(nxArgs: NxArgs, loadDotEnvFiles: boolean) {
  if (
    nxArgs.outputStyle == 'stream' ||
    process.env.NX_BATCH_MODE === 'true' ||
    nxArgs.batch
  ) {
    process.env.NX_STREAM_OUTPUT = 'true';
    process.env.NX_PREFIX_OUTPUT = 'true';
  }
  if (nxArgs.outputStyle == 'stream-without-prefixes') {
    process.env.NX_STREAM_OUTPUT = 'true';
  }
  if (loadDotEnvFiles) {
    process.env.NX_LOAD_DOT_ENV_FILES = 'true';
  }
}

export async function invokeTasksRunner({
  tasks,
  projectGraph,
  taskGraph,
  lifeCycle,
  nxJson,
  nxArgs,
  loadDotEnvFiles,
  initiatingProject,
}: {
  tasks: Task[];
  projectGraph: ProjectGraph;
  taskGraph: TaskGraph;
  lifeCycle: LifeCycle;
  nxJson: NxJsonConfiguration;
  nxArgs: NxArgs;
  loadDotEnvFiles: boolean;
  initiatingProject: string | null;
}): Promise<{ [id: string]: TaskResult }> {
  setEnvVarsBasedOnArgs(nxArgs, loadDotEnvFiles);

  // this needs to be done before we start to run the tasks
  const taskDetails = getTaskDetails();

  const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);

  let hasher = createTaskHasher(projectGraph, nxJson, runnerOptions);

  // this is used for two reasons: to fetch all remote cache hits AND
  // to submit everything that is known in advance to Nx Cloud to run in
  // a distributed fashion

  await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
    hasher,
    projectGraph,
    taskGraph,
    nxJson,
    taskDetails
  );
  const taskResultsLifecycle = new TaskResultsLifeCycle();
  const compositedLifeCycle: LifeCycle = new CompositeLifeCycle([
    ...constructLifeCycles(lifeCycle),
    taskResultsLifecycle,
  ]);

  let promiseOrObservable:
    | Observable<{ task: Task; success: boolean }>
    | Promise<{ [id: string]: TaskStatus }> = tasksRunner(
    tasks,
    {
      ...runnerOptions,
      lifeCycle: compositedLifeCycle,
    },
    {
      initiatingProject:
        nxArgs.outputStyle === 'compact' ? null : initiatingProject,
      projectGraph,
      nxJson,
      nxArgs,
      taskGraph,
      hasher: {
        hashTask(task: Task, taskGraph_?: TaskGraph, env?: NodeJS.ProcessEnv) {
          if (!taskGraph_) {
            output.warn({
              title: `TaskGraph is now required as an argument to hashTask`,
              bodyLines: [
                `The TaskGraph object can be retrieved from the context`,
                'This will result in an error in Nx 20',
              ],
            });
            taskGraph_ = taskGraph;
          }
          if (!env) {
            output.warn({
              title: `The environment variables are now required as an argument to hashTask`,
              bodyLines: [
                `Please pass the environment variables used when running the task`,
                'This will result in an error in Nx 20',
              ],
            });
            env = process.env;
          }
          return hasher.hashTask(task, taskGraph_, env);
        },
        hashTasks(
          task: Task[],
          taskGraph_?: TaskGraph,
          env?: NodeJS.ProcessEnv
        ) {
          if (!taskGraph_) {
            output.warn({
              title: `TaskGraph is now required as an argument to hashTasks`,
              bodyLines: [
                `The TaskGraph object can be retrieved from the context`,
                'This will result in an error in Nx 20',
              ],
            });
            taskGraph_ = taskGraph;
          }
          if (!env) {
            output.warn({
              title: `The environment variables are now required as an argument to hashTasks`,
              bodyLines: [
                `Please pass the environment variables used when running the tasks`,
                'This will result in an error in Nx 20',
              ],
            });
            env = process.env;
          }

          return hasher.hashTasks(task, taskGraph_, env);
        },
      },
      daemon: daemonClient,
    }
  );
  if ((promiseOrObservable as any).subscribe) {
    promiseOrObservable = convertObservableToPromise(
      promiseOrObservable as Observable<{ task: Task; success: boolean }>
    );
  }

  await (promiseOrObservable as Promise<{
    [id: string]: TaskStatus;
  }>);
  return taskResultsLifecycle.getTaskResults();
}

function constructLifeCycles(lifeCycle: LifeCycle): LifeCycle[] {
  const lifeCycles = [] as LifeCycle[];
  lifeCycles.push(new StoreRunInformationLifeCycle());
  lifeCycles.push(lifeCycle);
  if (process.env.NX_PERF_LOGGING === 'true') {
    lifeCycles.push(new TaskTimingsLifeCycle());
  }
  if (process.env.NX_PROFILE) {
    lifeCycles.push(new TaskProfilingLifeCycle(process.env.NX_PROFILE));
  }
  if (!isNxCloudUsed(readNxJson())) {
    lifeCycles.push(
      process.env.NX_DISABLE_DB !== 'true' && !IS_WASM
        ? new TaskHistoryLifeCycle()
        : new LegacyTaskHistoryLifeCycle()
    );
  }
  return lifeCycles;
}

async function convertObservableToPromise(
  obs: Observable<{ task: Task; success: boolean }>
): Promise<{ [id: string]: TaskStatus }> {
  return await new Promise((res) => {
    let tasksResults: { [id: string]: TaskStatus } = {};
    obs.subscribe({
      next: (t) => {
        tasksResults[t.task.id] = t.success ? 'success' : 'failure';
      },
      error: (error) => {
        output.error({
          title: 'Unhandled error in task executor',
        });
        console.error(error);
        res(tasksResults);
      },
      complete: () => {
        res(tasksResults);
      },
    });
  });
}

function shouldUseDynamicLifeCycle(
  tasks: Task[],
  options: any,
  outputStyle: string
) {
  if (
    process.env.NX_BATCH_MODE === 'true' ||
    process.env.NX_VERBOSE_LOGGING === 'true' ||
    process.env.NX_TASKS_RUNNER_DYNAMIC_OUTPUT === 'false'
  ) {
    return false;
  }
  if (!process.stdout.isTTY) return false;
  if (isCI()) return false;
  if (outputStyle === 'static' || outputStyle === 'stream') return false;

  return !tasks.find((t) => shouldStreamOutput(t, null));
}

function loadTasksRunner(modulePath: string): TasksRunner {
  try {
    const maybeTasksRunner = require(modulePath) as
      | TasksRunner
      | { default: TasksRunner };
    // to support both babel and ts formats
    return 'default' in maybeTasksRunner
      ? maybeTasksRunner.default
      : maybeTasksRunner;
  } catch (e) {
    if (
      e.code === 'MODULE_NOT_FOUND' &&
      (modulePath === 'nx-cloud' || modulePath === '@nrwl/nx-cloud')
    ) {
      return require('../nx-cloud/nx-cloud-tasks-runner-shell')
        .nxCloudTasksRunnerShell;
    }
    throw e;
  }
}

export function getRunner(
  nxArgs: NxArgs,
  nxJson: NxJsonConfiguration
): {
  tasksRunner: TasksRunner;
  runnerOptions: any;
} {
  let runner = nxArgs.runner;
  runner = runner ?? 'default';

  if (runner !== 'default' && !nxJson.tasksRunnerOptions?.[runner]) {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }

  const modulePath: string = getTasksRunnerPath(runner, nxJson);

  try {
    if (isCustomRunnerPath(modulePath)) {
      output.warn({
        title: `Custom task runners will no longer be supported in Nx 21.`,
        bodyLines: [
          `Use Nx Cloud or the Nx Powerpack caches instead.`,
          `For more information, see https://nx.dev/nx-enterprise/powerpack/custom-caching`,
        ],
      });
    }

    const tasksRunner = loadTasksRunner(modulePath);

    return {
      tasksRunner,
      runnerOptions: getRunnerOptions(
        runner,
        nxJson,
        nxArgs,
        modulePath === 'nx-cloud'
      ),
    };
  } catch {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }
}

const defaultTasksRunnerPath = require.resolve('./default-tasks-runner');

function getTasksRunnerPath(
  runner: string,
  nxJson: NxJsonConfiguration<string[] | '*'>
) {
  let modulePath: string = nxJson.tasksRunnerOptions?.[runner]?.runner;

  if (modulePath) {
    if (isRelativePath(modulePath)) {
      return join(workspaceRoot, modulePath);
    }
    return modulePath;
  }

  const isCloudRunner =
    // No tasksRunnerOptions for given --runner
    nxJson.nxCloudAccessToken ||
    // No runner prop in tasks runner options, check if access token is set.
    nxJson.tasksRunnerOptions?.[runner]?.options?.accessToken ||
    // Cloud access token specified in env var.
    process.env.NX_CLOUD_ACCESS_TOKEN ||
    // Nx Cloud ID specified in nxJson
    nxJson.nxCloudId;

  return isCloudRunner ? 'nx-cloud' : defaultTasksRunnerPath;
}

export function getRunnerOptions(
  runner: string,
  nxJson: NxJsonConfiguration<string[] | '*'>,
  nxArgs: NxArgs,
  isCloudDefault: boolean
): any {
  const defaultCacheableOperations = [];

  for (const key in nxJson.targetDefaults) {
    if (nxJson.targetDefaults[key].cache) {
      defaultCacheableOperations.push(key);
    }
  }

  const result = {
    ...nxJson.tasksRunnerOptions?.[runner]?.options,
    ...nxArgs,
  };

  // NOTE: we don't pull from env here because the cloud package
  // supports it within nx-cloud's implementation. We could
  // normalize it here, and that may make more sense, but
  // leaving it as is for now.
  if (nxJson.nxCloudAccessToken && isCloudDefault) {
    result.accessToken ??= nxJson.nxCloudAccessToken;
  }

  if (nxJson.nxCloudId && isCloudDefault) {
    result.nxCloudId ??= nxJson.nxCloudId;
  }

  if (nxJson.nxCloudUrl && isCloudDefault) {
    result.url ??= nxJson.nxCloudUrl;
  }

  if (nxJson.nxCloudEncryptionKey && isCloudDefault) {
    result.encryptionKey ??= nxJson.nxCloudEncryptionKey;
  }

  if (nxJson.parallel) {
    result.parallel ??= nxJson.parallel;
  }

  if (nxJson.cacheDirectory) {
    result.cacheDirectory ??= nxJson.cacheDirectory;
  }

  if (defaultCacheableOperations.length) {
    result.cacheableOperations ??= [];
    result.cacheableOperations = result.cacheableOperations.concat(
      defaultCacheableOperations
    );
  }

  if (nxJson.useDaemonProcess !== undefined) {
    result.useDaemonProcess ??= nxJson.useDaemonProcess;
  }

  return result;
}
function isCustomRunnerPath(modulePath: string) {
  return !['nx-cloud', '@nrwl/nx-cloud', defaultTasksRunnerPath].includes(
    modulePath
  );
}

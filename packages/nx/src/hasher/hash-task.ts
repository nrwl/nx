import { NxJsonConfiguration, readNxJson } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { IS_WASM, TaskDetails } from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getTaskIOService } from '../tasks-runner/task-io-service';
import { getTaskSpecificEnv } from '../tasks-runner/task-env';
import { getCustomHasher } from '../tasks-runner/utils';
import { getDbConnection } from '../utils/db-connection';
import { getInputs, TaskHasher } from './task-hasher';

let taskDetails: TaskDetails;

export function getTaskDetails(): TaskDetails | null {
  // TODO: Remove when wasm supports sqlite
  if (IS_WASM) {
    return null;
  }
  if (!taskDetails) {
    taskDetails = new TaskDetails(getDbConnection());
  }
  return taskDetails;
}

export async function hashTasksThatDoNotDependOnOutputsOfOtherTasks(
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  tasksDetails: TaskDetails | null
) {
  performance.mark('hashMultipleTasks:start');

  const projects =
    readProjectsConfigurationFromProjectGraph(projectGraph).projects;
  const tasks = Object.values(taskGraph.tasks);
  const tasksWithHashers = await Promise.all(
    tasks.map(async (task) => {
      const customHasher = getCustomHasher(task, projects);
      return { task, customHasher };
    })
  );

  const tasksToHash = tasksWithHashers
    .filter(({ task, customHasher }) => {
      // If a task has a custom hasher, it might depend on the outputs of other tasks
      if (customHasher) {
        return false;
      }

      return !(
        taskGraph.dependencies[task.id].length > 0 &&
        getInputs(task, projectGraph, nxJson).depsOutputs.length > 0
      );
    })
    .map((t) => t.task);

  const perTaskEnvs: Record<string, NodeJS.ProcessEnv> = {};
  for (const task of tasksToHash) {
    perTaskEnvs[task.id] = getTaskSpecificEnv(task, projectGraph);
  }
  const hashes = await hasher.hashTasks(tasksToHash, taskGraph, perTaskEnvs);
  const ioService = getTaskIOService();
  const hasInputSubscribers = ioService.hasTaskInputSubscribers();
  for (let i = 0; i < tasksToHash.length; i++) {
    tasksToHash[i].hash = hashes[i].value;
    tasksToHash[i].hashDetails = hashes[i].details;

    // Notify TaskIOService of hash inputs
    if (hasInputSubscribers && hashes[i].inputs) {
      ioService.notifyTaskInputs(tasksToHash[i].id, hashes[i].inputs);
    }
  }
  if (tasksDetails?.recordTaskDetails) {
    tasksDetails.recordTaskDetails(
      tasksToHash.map((task) => ({
        hash: task.hash,
        project: task.target.project,
        target: task.target.target,
        configuration: task.target.configuration,
      }))
    );
  }

  performance.mark('hashMultipleTasks:end');
  performance.measure(
    'hashMultipleTasks',
    'hashMultipleTasks:start',
    'hashMultipleTasks:end'
  );
}

export async function hashTask(
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  task: Task,
  env: NodeJS.ProcessEnv,
  taskDetails: TaskDetails | null
) {
  performance.mark('hashSingleTask:start');

  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const customHasher = getCustomHasher(task, projectsConfigurations.projects);

  const { value, details, inputs } = await (customHasher
    ? customHasher(task, {
        hasher,
        projectGraph,
        taskGraph,
        workspaceConfig: projectsConfigurations, // to make the change non-breaking. Remove after v19
        projectsConfigurations,
        nxJsonConfiguration: readNxJson(),
        env,
      } as any)
    : hasher.hashTask(task, taskGraph, env));
  task.hash = value;
  task.hashDetails = details;

  // Notify TaskIOService of hash inputs
  const ioService = getTaskIOService();
  if (ioService.hasTaskInputSubscribers() && inputs) {
    ioService.notifyTaskInputs(task.id, inputs);
  }

  if (taskDetails?.recordTaskDetails) {
    taskDetails.recordTaskDetails([
      {
        hash: task.hash,
        project: task.target.project,
        target: task.target.target,
        configuration: task.target.configuration,
      },
    ]);
  }

  performance.mark('hashSingleTask:end');
  performance.measure(
    'hashSingleTask',
    'hashSingleTask:start',
    'hashSingleTask:end'
  );
}

/**
 * Batch-hash `tasks`. `perTaskEnvs` must contain an entry keyed by
 * `task.id` for every task — the per-task env is what each task's
 * custom hasher sees and what the built-in hasher reads
 * `HashInstruction::Environment` inputs against. Callers that
 * genuinely want to hash against a single shared env should build
 * `{ [task.id]: env }` for every task.
 */
export async function hashTasks(
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
  taskDetails: TaskDetails | null,
  tasksToHashOverride?: Task[]
) {
  performance.mark('hashMultipleTasks:start');

  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const nxJson = readNxJson();

  const tasks = (tasksToHashOverride ?? Object.values(taskGraph.tasks)).filter(
    (task) => !task.hash
  );

  // Separate tasks with custom hashers from those without
  const tasksWithCustomHashers: Task[] = [];
  const tasksWithoutCustomHashers: Task[] = [];

  for (const task of tasks) {
    const customHasher = getCustomHasher(task, projectsConfigurations.projects);
    if (customHasher) {
      tasksWithCustomHashers.push(task);
    } else {
      tasksWithoutCustomHashers.push(task);
    }
  }

  // Hash tasks with custom hashers individually
  const ioService = getTaskIOService();
  const hasInputSubscribers = ioService.hasTaskInputSubscribers();
  const customHasherPromises = tasksWithCustomHashers.map(async (task) => {
    const customHasher = getCustomHasher(task, projectsConfigurations.projects);
    const { value, details, inputs } = await customHasher(task, {
      hasher,
      projectGraph,
      taskGraph,
      workspaceConfig: projectsConfigurations,
      projectsConfigurations,
      nxJsonConfiguration: nxJson,
      env: perTaskEnvs[task.id],
    } as any);
    task.hash = value;
    task.hashDetails = details;

    // Notify TaskIOService of hash inputs
    if (hasInputSubscribers && inputs) {
      ioService.notifyTaskInputs(task.id, inputs);
    }
  });

  // Hash tasks without custom hashers in batch
  let batchHashPromise: Promise<void> = Promise.resolve();
  if (tasksWithoutCustomHashers.length > 0) {
    batchHashPromise = hasher
      .hashTasks(tasksWithoutCustomHashers, taskGraph, perTaskEnvs)
      .then((hashes) => {
        for (let i = 0; i < tasksWithoutCustomHashers.length; i++) {
          tasksWithoutCustomHashers[i].hash = hashes[i].value;
          tasksWithoutCustomHashers[i].hashDetails = hashes[i].details;

          // Notify TaskIOService of hash inputs
          if (hasInputSubscribers && hashes[i].inputs) {
            ioService.notifyTaskInputs(
              tasksWithoutCustomHashers[i].id,
              hashes[i].inputs
            );
          }
        }
      });
  }

  await Promise.all([...customHasherPromises, batchHashPromise]);

  if (taskDetails?.recordTaskDetails) {
    // Guard against a custom hasher resolving with a falsy value —
    // the built-in batch hasher always produces a hash, but user-written
    // custom hashers are untrusted and an empty/undefined hash would
    // violate the task_details schema downstream.
    const hashedTasks = [];
    for (const t of tasks) {
      if (!t.hash) {
        continue;
      }

      hashedTasks.push({
        hash: t.hash,
        project: t.target.project,
        target: t.target.target,
        configuration: t.target.configuration,
      });
    }
    if (hashedTasks.length > 0) {
      taskDetails.recordTaskDetails(hashedTasks);
    }
  }

  performance.mark('hashMultipleTasks:end');
  performance.measure(
    'hashMultipleTasks',
    'hashMultipleTasks:start',
    'hashMultipleTasks:end'
  );
}

import { Task, TaskGraph } from '../config/task-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getInputs, TaskHasher } from './task-hasher';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { readNxJson } from '../config/nx-json';
import { HashedTask, IS_WASM, TaskDetails } from '../native';
import { getDbConnection } from '../utils/db-connection';
import { getTaskSpecificEnv } from '../tasks-runner/task-env';

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

  const tasks = Object.values(taskGraph.tasks);
  const tasksWithHashers = await Promise.all(
    tasks.map(async (task) => {
      const customHasher = getCustomHasher(task, projectGraph);
      return { task, customHasher };
    })
  );

  const tasksToHash = tasksWithHashers
    .filter(({ task, customHasher }) => {
      // If a task has a custom hasher, it might depend on the outputs of other tasks
      if (customHasher && customHasher.name !== 'eslint-hasher') {
        return false;
      }

      return !(
        taskGraph.dependencies[task.id].length > 0 &&
        getInputs(task, projectGraph, nxJson).depsOutputs.length > 0
      );
    })
    .map((t) => t.task);

  // Hash each task individually with its specific environment
  await Promise.all(
    tasksToHash.map(async (task) => {
      const taskEnv = getTaskSpecificEnv(task, projectGraph);
      const { value, details } = await hasher.hashTask(
        task,
        taskGraph,
        taskEnv
      );
      task.hash = value;
      task.hashDetails = details;
    })
  );
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

  const customHasher = getCustomHasher(task, projectGraph);
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);

  const { value, details } = await (customHasher
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

export async function hashTasks(
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  env: NodeJS.ProcessEnv,
  taskDetails: TaskDetails | null
) {
  performance.mark('hashMultipleTasks:start');

  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const nxJson = readNxJson();

  const tasks = Object.values(taskGraph.tasks).filter((task) => !task.hash);

  // Separate tasks with custom hashers from those without
  const tasksWithCustomHashers: Task[] = [];
  const tasksWithoutCustomHashers: Task[] = [];

  for (const task of tasks) {
    const customHasher = getCustomHasher(task, projectGraph);
    if (customHasher) {
      tasksWithCustomHashers.push(task);
    } else {
      tasksWithoutCustomHashers.push(task);
    }
  }

  // Hash tasks with custom hashers individually
  const customHasherPromises = tasksWithCustomHashers.map(async (task) => {
    const customHasher = getCustomHasher(task, projectGraph);
    const { value, details } = await customHasher(task, {
      hasher,
      projectGraph,
      taskGraph,
      workspaceConfig: projectsConfigurations,
      projectsConfigurations,
      nxJsonConfiguration: nxJson,
      env,
    } as any);
    task.hash = value;
    task.hashDetails = details;
  });

  // Hash tasks without custom hashers in batch
  let batchHashPromise: Promise<void> = Promise.resolve();
  if (tasksWithoutCustomHashers.length > 0) {
    batchHashPromise = hasher
      .hashTasks(tasksWithoutCustomHashers, taskGraph, env)
      .then((hashes) => {
        for (let i = 0; i < tasksWithoutCustomHashers.length; i++) {
          tasksWithoutCustomHashers[i].hash = hashes[i].value;
          tasksWithoutCustomHashers[i].hashDetails = hashes[i].details;
        }
      });
  }

  await Promise.all([...customHasherPromises, batchHashPromise]);

  if (taskDetails?.recordTaskDetails) {
    taskDetails.recordTaskDetails(
      tasks.map((task) => ({
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

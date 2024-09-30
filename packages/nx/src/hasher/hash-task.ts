import { Task, TaskGraph } from '../config/task-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getInputs, TaskHasher } from './task-hasher';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { readNxJson } from '../config/nx-json';
import { HashedTask, IS_WASM, TaskDetails } from '../native';
import { getDbConnection } from '../utils/db-connection';

let taskDetails: TaskDetails;

export function getTaskDetails(): TaskDetails | null {
  // TODO: Remove when wasm supports sqlite
  if (process.env.NX_DISABLE_DB === 'true' || IS_WASM) {
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
      if (customHasher) {
        return false;
      }

      return !(
        taskGraph.dependencies[task.id].length > 0 &&
        getInputs(task, projectGraph, nxJson).depsOutputs.length > 0
      );
    })
    .map((t) => t.task);

  const hashes = await hasher.hashTasks(tasksToHash, taskGraph, process.env);
  for (let i = 0; i < tasksToHash.length; i++) {
    tasksToHash[i].hash = hashes[i].value;
    tasksToHash[i].hashDetails = hashes[i].details;
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

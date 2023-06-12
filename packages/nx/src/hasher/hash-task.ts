import { Task, TaskGraph } from '../config/task-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getInputs, TaskHasher } from './task-hasher';
import { ProjectGraph } from '../config/project-graph';
import { Workspaces } from '../config/workspaces';
import { NxJsonConfiguration } from '../config/nx-json';

export async function hashTasksThatDoNotDependOnOutputsOfOtherTasks(
  workspaces: Workspaces,
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  nxJson: NxJsonConfiguration
) {
  const tasks = Object.values(taskGraph.tasks);
  const tasksWithHashers = await Promise.all(
    tasks.map(async (task) => {
      const customHasher = await getCustomHasher(
        task,
        workspaces,
        workspaces.readNxJson(),
        projectGraph
      );
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

  const hashes = await hasher.hashTasks(tasksToHash);
  for (let i = 0; i < tasksToHash.length; i++) {
    tasksToHash[i].hash = hashes[i].value;
    tasksToHash[i].hashDetails = hashes[i].details;
  }
}

export async function hashTask(
  workspaces: Workspaces,
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  task: Task
) {
  const customHasher = await getCustomHasher(
    task,
    workspaces,
    workspaces.readNxJson(),
    projectGraph
  );
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const { value, details } = await (customHasher
    ? customHasher(task, {
        hasher,
        projectGraph,
        taskGraph,
        workspaceConfig: projectsConfigurations, // to make the change non-breaking. Remove after v18
        projectsConfigurations,
        nxJsonConfiguration: workspaces.readNxJson(),
      } as any)
    : hasher.hashTask(task));
  task.hash = value;
  task.hashDetails = details;
}

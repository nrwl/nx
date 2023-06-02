import { Task, TaskGraph } from '../config/task-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { TaskHasher } from './task-hasher';
import { ProjectGraph } from '../config/project-graph';
import { Workspaces } from '../config/workspaces';

export async function hashTasksThatDoNotDependOnOtherTasks(
  workspaces: Workspaces,
  hasher: TaskHasher,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
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
    .filter((t) => !t.customHasher)
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

import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';
import { setHashEnv } from '../../hasher/set-hash-env';

/**
 * We use this not to recreated hasher for every hash operation
 * TaskHasher has a cache inside, so keeping it around results in faster performance
 */
let storedProjectGraph: any = null;
let storedHasher: InProcessTaskHasher | null = null;

export async function handleHashTasks(payload: {
  runnerOptions: any;
  env: any;
  tasks: Task[];
  taskGraph: TaskGraph;
}) {
  setHashEnv(payload.env);

  const { projectGraph, allWorkspaceFiles, projectFileMap } =
    await getCachedSerializedProjectGraphPromise();
  const nxJson = readNxJson();

  if (projectGraph !== storedProjectGraph) {
    storedProjectGraph = projectGraph;
    storedHasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      payload.runnerOptions
    );
  }
  const response = JSON.stringify(
    await storedHasher.hashTasks(payload.tasks, payload.taskGraph)
  );
  return {
    response,
    description: 'handleHashTasks',
  };
}

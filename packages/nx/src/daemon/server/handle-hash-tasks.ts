import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';
import { fileHasher } from '../../hasher/file-hasher';
import { setHashEnv } from '../../hasher/set-hash-env';

/**
 * We use this not to recreated hasher for every hash operation
 * TaskHasher has a cache inside, so keeping it around results in faster performance
 */
let storedProjectGraph: any = null;
let storedTaskGraph: any = null;
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
    storedTaskGraph = payload.taskGraph;
    storedHasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      payload.taskGraph,
      nxJson,
      payload.runnerOptions,
      fileHasher
    );
  }
  const response = JSON.stringify(await storedHasher.hashTasks(payload.tasks));
  return {
    response,
    description: 'handleHashTasks',
  };
}

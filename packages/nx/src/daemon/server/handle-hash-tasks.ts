import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';
import { DaemonProjectGraphError } from '../../project-graph/error-types';

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
  const {
    error,
    projectGraph: _graph,
    allWorkspaceFiles,
    fileMap,
    rustReferences,
  } = await getCachedSerializedProjectGraphPromise();

  let projectGraph = _graph;
  if (error) {
    if (error instanceof DaemonProjectGraphError) {
      projectGraph = error.projectGraph;
    } else {
      throw error;
    }
  }

  const nxJson = readNxJson();

  if (projectGraph !== storedProjectGraph) {
    storedProjectGraph = projectGraph;
    storedHasher = new InProcessTaskHasher(
      projectGraph,
      nxJson,
      rustReferences,
      payload.runnerOptions
    );
  }
  const response = JSON.stringify(
    await storedHasher.hashTasks(payload.tasks, payload.taskGraph, payload.env)
  );
  return {
    response,
    description: 'handleHashTasks',
  };
}

import { TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';

let storedProjectGraph: any = null;
let storedHasher: InProcessTaskHasher | null = null;

export async function handleClassifyTasks(payload: {
  taskIds: string[];
  taskGraph: TaskGraph;
}) {
  const { error, projectGraph, rustReferences } =
    await getCachedSerializedProjectGraphPromise();

  if (error) {
    throw error;
  }

  const nxJson = readNxJson();

  if (projectGraph !== storedProjectGraph) {
    storedProjectGraph = projectGraph;
    storedHasher = new InProcessTaskHasher(
      projectGraph,
      nxJson,
      rustReferences,
      {}
    );
  }
  const response = await storedHasher.classifyTasks(
    payload.taskIds,
    payload.taskGraph
  );
  return {
    response,
    description: 'handleClassifyTasks',
  };
}

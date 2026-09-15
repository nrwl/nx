import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';

/**
 * We use this not to recreated hasher for every hash operation
 * TaskHasher has a cache inside, so keeping it around results in faster performance
 */
let storedProjectGraph: any = null;
let storedHasher: InProcessTaskHasher | null = null;

interface HashTasksPayload {
  runnerOptions: any;
  tasks: Task[];
  taskGraph: TaskGraph;
  perTaskEnvs: Record<string, NodeJS.ProcessEnv>;
  cwd: string;
  collectInputs?: boolean;
}

async function getHasher(runnerOptions: any): Promise<InProcessTaskHasher> {
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
      runnerOptions
    );
  }
  return storedHasher;
}

export async function handleHashTasks(payload: HashTasksPayload) {
  const hasher = await getHasher(payload.runnerOptions);
  const response = await hasher.hashTasks(
    payload.tasks,
    payload.taskGraph,
    payload.perTaskEnvs,
    payload.cwd,
    payload.collectInputs
  );
  return {
    response,
    description: 'handleHashTasks',
  };
}

export async function handleHashTasksUpfront(payload: HashTasksPayload) {
  const hasher = await getHasher(payload.runnerOptions);
  const response = await hasher.hashTasksUpfront(
    payload.tasks,
    payload.taskGraph,
    payload.perTaskEnvs,
    payload.cwd,
    payload.collectInputs
  );
  return {
    response,
    description: 'handleHashTasksUpfront',
  };
}

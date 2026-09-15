import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';
import { loadIoSnapshots, type IoSnapshots } from '../../native';
import { getDbConnection } from '../../utils/db-connection';

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
  ioSnapshots?: { commit?: string };
}

// An External cannot cross the socket, so the client sends the commit of the
// set it resolved and the daemon reads that set from the database. Absent
// (incl. older clients) ⇒ native hashing. The latest handle is kept while its
// commit and digest hold, so entries read for one request serve the next;
// a new commit or a re-imported set replaces it, so nothing accumulates.
let loaded: { commit: string; handle: IoSnapshots } | null = null;
function loadedIoSnapshots(payload: HashTasksPayload) {
  const commit = payload.ioSnapshots?.commit;
  if (!commit) {
    return undefined;
  }
  const fresh = loadIoSnapshots(getDbConnection(), commit);
  if (
    loaded?.commit === commit &&
    loaded.handle.resolution?.digest === fresh.resolution?.digest
  ) {
    return loaded.handle;
  }
  loaded = { commit, handle: fresh };
  return fresh;
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
    payload.collectInputs,
    loadedIoSnapshots(payload)
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
    payload.collectInputs,
    loadedIoSnapshots(payload)
  );
  return {
    response,
    description: 'handleHashTasksUpfront',
  };
}

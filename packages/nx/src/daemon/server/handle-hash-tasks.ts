import { Task, TaskGraph } from '../../config/task-graph';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { readNxJson } from '../../config/configuration';
import { loadIoSnapshots } from '../../native';

/**
 * We use this not to recreated hasher for every hash operation
 * TaskHasher has a cache inside, so keeping it around results in faster performance
 */
let storedProjectGraph: any = null;
let storedHasher: InProcessTaskHasher | null = null;

export async function handleHashTasks(payload: {
  runnerOptions: any;
  tasks: Task[];
  taskGraph: TaskGraph;
  perTaskEnvs: Record<string, NodeJS.ProcessEnv>;
  cwd: string;
  collectInputs?: boolean;
  ioSnapshots?: { directory?: string };
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
      payload.runnerOptions
    );
  }
  const response = await storedHasher.hashTasks(
    payload.tasks,
    payload.taskGraph,
    payload.perTaskEnvs,
    payload.cwd,
    payload.collectInputs,
    // An External cannot cross the socket, so the client sends the bundle
    // directory (which pins the HEAD it fetched for) and the daemon loads it
    // (mtime-cached in Rust). Absent (incl. older clients) ⇒ native hashing.
    payload.ioSnapshots?.directory
      ? loadIoSnapshots(payload.ioSnapshots.directory)
      : undefined
  );
  return {
    response,
    description: 'handleHashTasks',
  };
}

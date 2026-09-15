import type { TaskGraph } from '../config/task-graph';
import { serialize } from '../daemon/socket-utils';
import { isLegacyIpc } from '../utils/legacy-ipc';

/**
 * Executors receive the task graph as it stood when execution started. Hashes
 * are part of that contract; the timings written onto tasks as they finish are
 * not. So the encoded bytes are reused across every worker fork and redone
 * only when a task's hash changes, which happens for tasks re-hashed once their
 * dependencies' outputs exist. Plugin hooks never come through here and always
 * see the live graph. Under `NX_LEGACY_IPC` the graph itself is returned and
 * the channel serializes it per fork, as before.
 */
const encodedGraphs = new WeakMap<
  TaskGraph,
  { signature: string; bytes: Buffer }
>();

export function encodeTaskGraphForWorker(graph: TaskGraph): Buffer | TaskGraph {
  if (isLegacyIpc()) return graph;
  let signature = '';
  for (const id in graph.tasks) signature += graph.tasks[id].hash ?? '\0';
  const cached = encodedGraphs.get(graph);
  if (cached?.signature === signature) return cached.bytes;
  const bytes = serialize(graph);
  encodedGraphs.set(graph, { signature, bytes });
  return bytes;
}

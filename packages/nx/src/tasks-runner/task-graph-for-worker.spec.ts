import type { TaskGraph } from '../config/task-graph';
import { parseMessage } from '../utils/consume-messages-from-socket';
import { encodeTaskGraphForWorker } from './task-graph-for-worker';

function graph(): TaskGraph {
  const tasks: TaskGraph['tasks'] = {};
  for (let t = 0; t < 30; t++) {
    const nodes: Record<string, string> = {};
    for (let i = 0; i < 100; i++) nodes[`workspace:lib/file-${i}.ts`] = 'h';
    tasks[`p${t}:build`] = {
      id: `p${t}:build`,
      target: { project: `p${t}`, target: 'build' },
      overrides: {},
      outputs: [],
      projectRoot: `libs/p${t}`,
      parallelism: true,
      continuous: false,
      hash: `hash-${t}`,
      hashDetails: { command: 'build', nodes, implicitDeps: {}, runtime: {} },
    } as any;
  }
  return {
    tasks,
    roots: Object.keys(tasks),
    dependencies: {},
    continuousDependencies: {},
  };
}

describe('encodeTaskGraphForWorker', () => {
  it('reuses the same bytes for the same graph', () => {
    const g = graph();
    expect(encodeTaskGraphForWorker(g)).toBe(encodeTaskGraphForWorker(g));
  });

  it('does not re-encode when timings are written onto tasks', () => {
    const g = graph();
    const first = encodeTaskGraphForWorker(g);
    g.tasks['p1:build'].startTime = 1;
    g.tasks['p1:build'].endTime = 2;
    expect(encodeTaskGraphForWorker(g)).toBe(first);
  });

  it('re-encodes when a task is re-hashed', () => {
    const g = graph();
    const first = encodeTaskGraphForWorker(g);
    g.tasks['p1:build'].hash = undefined;
    g.tasks['p1:build'].hashDetails = undefined;
    const cleared = encodeTaskGraphForWorker(g);
    expect(cleared).not.toBe(first);
    g.tasks['p1:build'].hash = 'rehashed';
    const rehashed = encodeTaskGraphForWorker(g);
    expect(rehashed).not.toBe(cleared);
    expect(parseMessage<TaskGraph>(rehashed).tasks['p1:build'].hash).toBe(
      'rehashed'
    );
  });

  it('round-trips the graph through parseMessage', () => {
    const g = graph();
    expect(parseMessage(encodeTaskGraphForWorker(g))).toEqual(g);
  });
});

import type { TaskGraph } from '../config/task-graph';
import { pruneTaskGraph } from './prune-task-graph';

function graph(): TaskGraph {
  const task = (id: string) =>
    ({
      id,
      target: { project: id, target: 'build' },
      overrides: {},
      outputs: [],
      hash: `hash-${id}`,
      hashDetails: { command: 'build', nodes: {} },
      startTime: 1,
      endTime: 2,
      terminalOutput: 'output',
    }) as any;
  return {
    roots: ['a'],
    dependencies: { a: [], b: ['a'] },
    continuousDependencies: {},
    tasks: { a: task('a'), b: task('b') },
  };
}

describe('pruneTaskGraph', () => {
  it('removes every run result and keeps the structure', () => {
    const g = graph();
    const pruned = pruneTaskGraph(g);
    expect(pruned).not.toBe(g);
    expect(pruned.roots).toBe(g.roots);
    expect(pruned.dependencies).toBe(g.dependencies);
    expect(Object.keys(pruned.tasks)).toEqual(['a', 'b']);
    expect(pruned.tasks.b).toEqual({
      id: 'b',
      target: { project: 'b', target: 'build' },
      overrides: {},
      outputs: [],
    });
    expect(pruned.tasks.b.target).toBe(g.tasks.b.target);
  });

  it('leaves the source graph untouched', () => {
    const g = graph();
    pruneTaskGraph(g);
    expect(g.tasks.a.hash).toBe('hash-a');
    expect(g.tasks.a.hashDetails).toBeDefined();
    expect((g.tasks.a as any).terminalOutput).toBe('output');
  });

  it('returns the same copy for the same graph, whatever results land on it', () => {
    const g = graph();
    const first = pruneTaskGraph(g);
    g.tasks.a.hash = 'rehashed';
    g.tasks.b.startTime = 99;
    (g.tasks.b as any).terminalOutput = 'more';
    expect(pruneTaskGraph(g)).toBe(first);
    expect(pruneTaskGraph(graph())).not.toBe(first);
  });
});

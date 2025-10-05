import { topologicalSort } from './topological-sort';

describe('topologicalSort', () => {
  it('should return nodes in topological order for a simple acyclic graph', () => {
    // A -> B -> C
    // |         ^
    // v         |
    // D --------|

    const nodes = ['A', 'B', 'C', 'D'];
    const edges = {
      A: ['B', 'D'],
      B: ['C'],
      C: [],
      D: ['C'],
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // Verify that dependencies come before dependents
    const indexA = result.indexOf('A');
    const indexB = result.indexOf('B');
    const indexC = result.indexOf('C');
    const indexD = result.indexOf('D');

    expect(indexB).toBeLessThan(indexA); // B before A
    expect(indexD).toBeLessThan(indexA); // D before A
    expect(indexC).toBeLessThan(indexB); // C before B
    expect(indexC).toBeLessThan(indexD); // C before D
  });

  it('should handle cycles by breaking them', () => {
    // A -> B -> C -> A (cycle)
    // |
    // v
    // D

    const nodes = ['A', 'B', 'C', 'D'];
    const edges = {
      A: ['B', 'D'],
      B: ['C'],
      C: ['A'], // Creates cycle
      D: [],
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // Even with a cycle, we should have all nodes
    expect(result.length).toBe(4);

    // All nodes should be in the result
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('D');
  });

  it('should handle complex examples with multiple cycles', () => {
    // A -> B -> C -> A (cycle 1)
    // |         ^
    // v         |
    // D -> E -> F -> D (cycle 2)

    const nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    const edges = {
      A: ['B', 'D'],
      B: ['C'],
      C: ['A'], // Cycle 1
      D: ['E'],
      E: ['F', 'C'],
      F: ['D'], // Cycle 2
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // Even with cycles, we should have all nodes
    expect(result.length).toBe(6);

    // All nodes should be in the result
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('D');
    expect(result).toContain('E');
    expect(result).toContain('F');
  });

  it('should handle self-dependencies', () => {
    // A -> A (self-cycle)
    // B -> B (self-cycle)

    const nodes = ['A', 'B'];
    const edges = {
      A: ['A'], // Self-cycle
      B: ['B'], // Self-cycle
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // All nodes should be in the result
    expect(result.length).toBe(2);
    expect(result).toContain('A');
    expect(result).toContain('B');
  });

  it('should handle empty input', () => {
    const result = topologicalSort([], () => []);
    expect(result).toEqual([]);
  });

  it('should handle disconnected nodes', () => {
    // A   C   E
    // |   |
    // v   v
    // B   D

    const nodes = ['A', 'B', 'C', 'D', 'E'];
    const edges = {
      A: ['B'],
      B: [],
      C: ['D'],
      D: [],
      E: [],
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // All nodes should be in the result
    expect(result.length).toBe(5);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('D');
    expect(result).toContain('E');

    // Check partial ordering
    const indexA = result.indexOf('A');
    const indexB = result.indexOf('B');
    const indexC = result.indexOf('C');
    const indexD = result.indexOf('D');

    expect(indexB).toBeLessThan(indexA); // B before A
    expect(indexD).toBeLessThan(indexC); // D before C
  });

  it('should handle circular dependencies between two nodes', () => {
    // A <-> B

    const nodes = ['A', 'B'];
    const edges = {
      A: ['B'],
      B: ['A'],
    };

    const getEdges = (node: string) => edges[node];

    const result = topologicalSort(nodes, getEdges);

    // All nodes should be in the result
    expect(result.length).toBe(2);
    expect(result).toContain('A');
    expect(result).toContain('B');
  });
});

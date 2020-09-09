import { checkCircularPath } from './runtime-lint-utils';

function transformGraph(graph) {
  const nodes = graph.nodes.reduce((acc, name) => {
    return {
      ...acc,
      [name]: { name }
    };
  }, {});

  const dependencies = Object.keys(graph.dependencies).reduce((acc, dep) => {
    const targets = graph.dependencies[dep].reduce((acc, name) => {
      return [...acc, { source: dep, target: name }];
    }, []);

    return {
      ...acc,
      [dep]: targets
    };
  }, {});

  return {
    nodes,
    dependencies
  };
}

function getPath(graph, node) {
  return checkCircularPath(graph as any, { name: node.to } as any, { name: node.from } as any);
}

describe('should find the path between nodes', () => {
  it('should return empty path when when there are no connecting edges', () => {
    /*

    A -> B -> C - > E

     */

    const graph = {
      nodes: ['A', 'B', 'C', 'E'],
      dependencies: {
        'A': ['B'],
        'B': ['C'],
        'C': ['E']
      }
    };

    const g = transformGraph(graph);
    const path = getPath(g, { from: 'B', to: 'A' });

    expect(path).toEqual([]);
  });

  it('should find direct path', () => {
    /*

    A -> B -> C - > E

    */

    const graph = {
      nodes: ['A', 'B', 'C'],
      dependencies: {
        'A': ['B']
      }
    };

    const g = transformGraph(graph);
    const path = getPath(g, { from: 'A', to: 'B' });

    expect(path).toEqual(['A', 'B']);
  });

  it('should find indirect path', () => {

    /*

    A -> B -> E -> F
         \
          C -> D

    */

    const graph = {
      nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
      dependencies: {
        A: ['B'],
        B: ['C', 'E'],
        C: ['D'],
        E: ['F']
      }
    };

    const g = transformGraph(graph);
    const path = getPath(g, { from: 'A', to: 'F' });

    expect(path).toEqual(['A', 'B', 'E', 'F']);
  });

  it('should find indirect path in a graph that has a simple cycle', () => {

    /*

    A -> B -> C -> F
     \       /
      E <-- D

    */

    const graph = {
      nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
      dependencies: {
        A: ['B'],
        B: ['C'],
        C: ['D', 'F'],
        D: ['E'],
        E: ['A']
      }
    };

    const g = transformGraph(graph);
    const path = getPath(g, { from: 'A', to: 'F' });

    expect(path).toEqual(['A', 'B', 'C', 'F']);
  });

  it('should find indirect path in a graph that has a cycle', () => {
    /*

    B <- A ->  D -> E
     \  /^
      C

    */

    const graph = {
      nodes: ['A', 'B', 'C', 'D', 'E'],
      dependencies: {
        A: ['B', 'D'],
        B: ['C'],
        C: ['A'],
        D: ['E']
      }
    };

    const g = transformGraph(graph);
    const path = getPath(g, { from: 'A', to: 'E' });

    expect(path).toEqual(['A', 'D', 'E']);
  });

  it('should find indirect path in a graph with inner and outer cycles', () => {

    /*

        A  -->  B
      /^  \   /^ \
     C    D  E   F
     ^\  /   ^\  /
       G  <--  H

    */

    const graph = {
      nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      dependencies: {
        A: ['B', 'D'],
        B: ['F'],
        C: ['A'],
        D: ['G'],
        E: ['B'],
        F: ['H'],
        G: ['C'],
        H: ['G', 'E']
      }
    };

    const g = transformGraph(graph);

    const path1 = getPath(g, { from: 'A', to: 'H' });
    expect(path1).toEqual(['A', 'B', 'F', 'H']);

    const path2 = getPath(g, { from: 'A', to: 'G' });
    expect(path2).toEqual(['A', 'D', 'G']);

    const path3 = getPath(g, { from: 'B', to: 'D' });
    expect(path3).toEqual(['B', 'F', 'H', 'G', 'C', 'A', 'D']);
  });
});

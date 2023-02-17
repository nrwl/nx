import {
  findAmbiguousTargets,
  findCycle,
  makeAcyclic,
} from './task-graph-utils';

describe('task graph utils', () => {
  describe('findCycles', () => {
    it('should return a cycle if it is there', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q', 'a'],
            q: [],
          },
        } as any)
      ).toEqual(['a', 'c', 'e', 'a']);
    });

    it('should return null when no cycle', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q'],
            q: [],
          },
        } as any)
      ).toEqual(null);
    });
  });

  describe('makeAcyclic', () => {
    it('should remove cycles when they are there', () => {
      const graph = {
        roots: ['d'],
        dependencies: {
          a: ['b', 'c'],
          b: ['d'],
          c: ['e'],
          d: [],
          e: ['a'],
        },
      } as any;
      makeAcyclic(graph);

      expect(graph.dependencies).toEqual({
        a: ['b', 'c'],
        b: ['d'],
        c: ['e'],
        d: [],
        e: [],
      });
      expect(graph.roots).toEqual(['d', 'e']);
    });
  });

  describe('findAmbiguousTargets', () => {
    it('should find ambiguous targets', () => {
      const graph = {
        tasks: {
          'app1:build': {
            target: {
              project: 'app1',
              target: 'build',
            },
          },
          'lib1:build:production': {
            target: {
              project: 'lib1',
              target: 'build',
              configuration: 'production',
            },
          },
          'lib3:build:production': {
            target: {
              project: 'lib3',
              target: 'build',
              configuration: 'production',
            },
          },
          'lib3:build:ci': {
            target: {
              project: 'lib3',
              target: 'build',
              configuration: 'ci',
            },
          },
        },
      } as any;

      expect(findAmbiguousTargets(graph)).toEqual([
        ['lib3:build:production', 'lib3:build:ci'],
      ]);
    });
  });
});

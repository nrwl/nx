import { ProjectGraphProjectNode } from '../../config/project-graph';
import { normalizeImplicitDependencies } from './normalize-project-nodes';

describe('workspace-projects', () => {
  let projectGraph: Record<string, ProjectGraphProjectNode> = {
    'test-project': {
      name: 'test-project',
      type: 'lib',
      data: {
        root: 'lib/test-project',
        tags: ['api', 'theme1'],
      },
    },
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'lib/a',
        tags: ['api', 'theme2'],
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: {
        root: 'lib/b',
        tags: ['ui'],
      },
    },
    c: {
      name: 'c',
      type: 'lib',
      data: {
        root: 'lib/c',
        tags: ['api'],
      },
    },
  };

  describe('normalizeImplicitDependencies', () => {
    it('should expand "*" implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', ['*'], projectGraph)
      ).toEqual(['a', 'b', 'c']);
    });

    it('should return [] for null implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', null, projectGraph)
      ).toEqual([]);
    });

    it('should expand glob based implicit dependencies', () => {
      const projectGraphMod: typeof projectGraph = {
        ...projectGraph,
        'b-1': {
          name: 'b-1',
          type: 'lib',
          data: {
            root: 'lib/b-1',
            tags: [],
          },
        },
        'b-2': {
          name: 'b-2',
          type: 'lib',
          data: {
            root: 'lib/b-2',
            tags: [],
          },
        },
      };
      const results = normalizeImplicitDependencies(
        'test-project',
        ['b*'],
        projectGraphMod
      );
      expect(results).toEqual(expect.arrayContaining(['b', 'b-1', 'b-2']));
      expect(results).not.toContain('a');
    });

    it('should handle negative projects correctly', () => {
      const results = normalizeImplicitDependencies(
        'test-project',
        ['*', '!a'],
        projectGraph
      );
      // a is excluded
      expect(results).not.toContain('a');
      // b and c are included by wildcard
      expect(results).toEqual(expect.arrayContaining(['b', 'c']));
      // !a should remain in the list, to remove deps on a if they exist
      expect(results).toContain('!a');
    });

    it('should handle negative patterns', () => {
      const results = normalizeImplicitDependencies(
        'test-project',
        ['!tag:api'],
        projectGraph
      );
      // No projects are included by provided patterns
      expect(results.filter((x) => !x.startsWith('!'))).toHaveLength(0);
      // tag:api was expanded, and results included for later processing.
      expect(results).toEqual(
        expect.arrayContaining(['!a', '!c', '!test-project'])
      );
    });
  });
});

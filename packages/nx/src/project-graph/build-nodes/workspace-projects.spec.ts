import { normalizeImplicitDependencies } from './workspace-projects';

describe('workspace-projects', () => {
  let projectsSet: Set<string>;

  beforeEach(() => {
    projectsSet = new Set(['test-project', 'a', 'b', 'c']);
  });

  describe('normalizeImplicitDependencies', () => {
    it('should expand "*" implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies(
          'test-project',
          ['*'],
          Array.from(projectsSet),
          projectsSet
        )
      ).toEqual(['a', 'b', 'c']);
    });

    it('should return [] for null implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies(
          'test-project',
          null,
          Array.from(projectsSet),
          projectsSet
        )
      ).toEqual([]);
    });

    it('should expand glob based implicit dependencies', () => {
      projectsSet.add('b-1');
      projectsSet.add('b-2');
      expect(
        normalizeImplicitDependencies(
          'test-project',
          ['b*'],
          Array.from(projectsSet),
          projectsSet
        )
      ).toEqual(['b', 'b-1', 'b-2']);
    });
  });
});

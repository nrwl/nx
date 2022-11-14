import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import { normalizeImplicitDependencies } from './workspace-projects';

describe('workspace-projects', () => {
  describe('normalizeImplicitDependencies', () => {
    it('should expand "*" implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', ['*'], {
          fileMap: {},
          filesToProcess: {},
          workspace: {
            version: 2,
            projects: {
              ...makeProject('test-project'),
              ...makeProject('a'),
              ...makeProject('b'),
              ...makeProject('c'),
            },
          },
        })
      ).toEqual(['a', 'b', 'c']);
    });

    it('should return [] for null implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', null, {
          fileMap: {},
          filesToProcess: {},
          workspace: {
            version: 2,
            projects: {
              ...makeProject('test-project'),
              ...makeProject('a'),
              ...makeProject('b'),
              ...makeProject('c'),
            },
          },
        })
      ).toEqual([]);
    });

    it('should expand glob based implicit dependencies', () => {
      expect(
        normalizeImplicitDependencies('test-project', ['b*'], {
          fileMap: {},
          filesToProcess: {},
          workspace: {
            version: 2,
            projects: {
              ...makeProject('test-project'),
              ...makeProject('a'),
              ...makeProject('b'),
              ...makeProject('b-1'),
              ...makeProject('b-2'),
              ...makeProject('c'),
            },
          },
        })
      ).toEqual(['b', 'b-1', 'b-2']);
    });
  });
});

function makeProject(name: string): Record<string, ProjectConfiguration> {
  return {
    [name]: {
      root: `packages/${name}`,
    },
  };
}

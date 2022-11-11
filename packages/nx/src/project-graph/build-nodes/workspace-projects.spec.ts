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
  });
});

function makeProject(name: string): Record<string, ProjectConfiguration> {
  return {
    [name]: {
      root: `packages/${name}`,
    },
  };
}

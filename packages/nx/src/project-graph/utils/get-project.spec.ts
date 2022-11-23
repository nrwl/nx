import { createProjectPathMappings, getProjectForPath } from './get-project';
import { ProjectGraph } from '../../config/project-graph';

describe('get project utils', () => {
  let projGraph: ProjectGraph;
  beforeEach(() => {
    projGraph = {
      nodes: {
        'demo-app': {
          name: 'demo-app',
          type: 'app',
          data: {
            root: 'apps/demo-app',
            files: [],
          },
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: {
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library',
            targets: {},
            files: [],
          },
        },
        core: {
          name: 'core',
          type: 'lib',
          data: {
            root: 'libs/core',
            sourceRoot: 'libs/core/src',
            projectType: 'library',
            targets: {},
            files: [],
          },
        },
        'implicit-lib': {
          name: 'implicit-lib',
          type: 'lib',
          data: {
            files: [],
          },
        },
      },
      dependencies: {
        'demo-app': [
          {
            type: 'static',
            source: 'demo-app',
            target: 'ui',
          },
          {
            type: 'static',
            source: 'demo-app',
            target: 'npm:chalk',
          },
          {
            type: 'static',
            source: 'demo-app',
            target: 'core',
          },
        ],
      },
    };
  });

  describe('getProjectForPath', () => {
    let projectPathMapping;
    beforeEach(() => {
      projectPathMapping = createProjectPathMappings(projGraph.nodes);
    });
    it('should find the project given a file within its src root', () => {
      expect(getProjectForPath('apps/demo-app', projectPathMapping)).toEqual(
        'demo-app'
      );

      expect(
        getProjectForPath('apps/demo-app/src', projectPathMapping)
      ).toEqual('demo-app');

      expect(
        getProjectForPath('apps/demo-app/src/subdir/bla', projectPathMapping)
      ).toEqual('demo-app');
    });
  });
});

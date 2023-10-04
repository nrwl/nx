import {
  createProjectRootMappings,
  findProjectForPath,
} from './find-project-for-path';
import { ProjectGraph } from '../../config/project-graph';

describe('get project utils', () => {
  let projectGraph: ProjectGraph;
  let projectRootMappings: Map<string, string>;
  describe('findProject', () => {
    beforeEach(() => {
      projectGraph = {
        nodes: {
          'demo-app': {
            name: 'demo-app',
            type: 'app',
            data: {
              root: 'apps/demo-app',
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
            },
          },
          'implicit-lib': {
            name: 'implicit-lib',
            type: 'lib',
            data: {},
          },
        } as any,
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

      projectRootMappings = createProjectRootMappings(projectGraph.nodes);
    });

    it('should find the project given a file within its src root', () => {
      expect(findProjectForPath('apps/demo-app', projectRootMappings)).toEqual(
        'demo-app'
      );

      expect(
        findProjectForPath('apps/demo-app/src', projectRootMappings)
      ).toEqual('demo-app');

      expect(
        findProjectForPath('apps/demo-app/src/subdir/bla', projectRootMappings)
      ).toEqual('demo-app');
    });
  });
});

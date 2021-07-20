import { ProjectGraph } from '../core/project-graph';
import {
  getProjectNameFromDirPath,
  getSourceDirOfDependentProjects,
} from './project-graph-utils';

describe('project graph utils', () => {
  describe('getSourceDirOfDependentProjects', () => {
    const projGraph: ProjectGraph = {
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
    it('should correctly gather the source root dirs of the dependent projects', () => {
      const paths = getSourceDirOfDependentProjects('demo-app', projGraph);

      expect(paths.length).toBe(2);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
      expect(paths).toContain(projGraph.nodes['core'].data.sourceRoot);
    });

    it('should throw an error if the project does not exist', () => {
      expect(() =>
        getSourceDirOfDependentProjects('non-existent-app', projGraph)
      ).toThrowError();
    });

    it('should find the project given a file within its src root', () => {
      expect(getProjectNameFromDirPath('apps/demo-app', projGraph)).toEqual(
        'demo-app'
      );

      expect(getProjectNameFromDirPath('apps/demo-app/src', projGraph)).toEqual(
        'demo-app'
      );

      expect(
        getProjectNameFromDirPath('apps/demo-app/src/subdir/bla', projGraph)
      ).toEqual('demo-app');
    });

    it('should throw an error if the project name has not been found', () => {
      expect(() => {
        getProjectNameFromDirPath('apps/demo-app-unknown');
      }).toThrowError();
    });
  });
});

import { ProjectGraph } from '../config/project-graph';
import { getSourceDirOfDependentProjects } from './project-graph-utils';

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
        'implicit-lib': {
          name: 'implicit-lib',
          type: 'lib',
          data: {},
        },
      },
      externalNodes: {
        'npm:chalk': {},
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
    } as any;
    it('should correctly gather the source root dirs of the dependent projects', () => {
      const [paths] = getSourceDirOfDependentProjects('demo-app', projGraph);

      expect(paths.length).toBe(2);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
      expect(paths).toContain(projGraph.nodes['core'].data.sourceRoot);
    });

    it('should handle circular dependencies', () => {
      projGraph.dependencies['core'] = [
        {
          type: 'static',
          source: 'core',
          target: 'demo-app',
        },
      ];
      const [paths] = getSourceDirOfDependentProjects('demo-app', projGraph);
      expect(paths).toContain(projGraph.nodes['ui'].data.sourceRoot);
    });

    it('should throw an error if the project does not exist', () => {
      expect(() =>
        getSourceDirOfDependentProjects('non-existent-app', projGraph)
      ).toThrowError();
    });

    describe('Given there is implicit library with no sourceRoot', () => {
      it('should return a warnings array with the library with no sourceRoot', () => {
        projGraph.dependencies['demo-app'].push({
          type: 'implicit',
          source: 'demo-app',
          target: 'implicit-lib',
        });

        const [_, warnings] = getSourceDirOfDependentProjects(
          'demo-app',
          projGraph
        );
        expect(warnings).toContain('implicit-lib');
      });
    });
  });
});

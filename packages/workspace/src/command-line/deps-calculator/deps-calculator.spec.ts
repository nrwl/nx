import {
  DependencyType,
  NxDepsJson,
  ProjectNode,
  ProjectType
} from '../shared-models';
import { serializeJson } from '../../utils/fileutils';
import { DepsCalculator } from './deps-calculator';

describe('DepsCalculator', () => {
  let depsCalculator: DepsCalculator;
  let initialDeps: NxDepsJson;
  let virtualFs: {
    [key: string]: string;
  };
  let projects: ProjectNode[];
  let fileRead: (path: string) => string;

  beforeEach(() => {
    initialDeps = {
      dependencies: {},
      files: {}
    };
    virtualFs = {};
    projects = [
      {
        name: 'app1Name',
        root: 'apps/app1',
        files: ['app1.ts'],
        fileMTimes: {
          'app1.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.app
      },
      {
        name: 'lib1Name',
        root: 'libs/lib1',
        files: ['lib1.ts'],
        fileMTimes: {
          'lib1.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.lib
      },
      {
        name: 'lib2Name',
        root: 'libs/lib2',
        files: ['lib2.ts'],
        fileMTimes: {
          'lib2.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.lib
      }
    ];
    fileRead = file => {
      switch (file) {
        case 'dist/nxdeps.json':
          return serializeJson(initialDeps);
        default:
          return virtualFs[file];
      }
    };
  });

  describe('initialization', () => {
    it('should not be incremental for new graphs', () => {
      depsCalculator = new DepsCalculator('nrwl', projects, null, {}, fileRead);
      expect(depsCalculator.getDeps()).toEqual({
        lib2Name: [],
        lib1Name: [],
        app1Name: []
      });
      expect(depsCalculator.incrementalEnabled).toEqual(false);
    });

    it('should be incremental for an existing graph with no projects added or removed', () => {
      initialDeps.dependencies = {
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        lib1Name: [],
        lib2Name: []
      };
      initialDeps.files = {
        'app1.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        'lib1.ts': [],
        'lib2.ts': []
      };
      const result = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
      expect(result.incrementalEnabled).toEqual(true);
      expect(result.getDeps()).toEqual({
        lib2Name: [],
        lib1Name: [],
        app1Name: [
          {
            projectName: 'lib1Name',
            type: 'loadChildren'
          },
          {
            projectName: 'lib2Name',
            type: 'loadChildren'
          }
        ]
      });
    });

    it('should not be incremental if projects are added to an existing graph', () => {
      initialDeps.dependencies = {
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        lib1Name: [],
        lib2Name: []
      };
      initialDeps.files = {
        'app1.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        'lib1.ts': [],
        'lib2.ts': []
      };
      projects = [
        ...projects,
        {
          name: 'lib3Name',
          root: 'libs/lib3',
          files: ['lib3.ts'],
          fileMTimes: {
            'lib3.ts': 1
          },
          tags: [],
          implicitDependencies: [],
          architect: {},
          type: ProjectType.lib
        }
      ];
      const result = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
      expect(result.incrementalEnabled).toEqual(false);
      expect(result.getDeps()).toEqual({
        app1Name: [],
        lib1Name: [],
        lib2Name: [],
        lib3Name: []
      });
    });

    it('should not be incremental if projects are removed from an existing graph', () => {
      initialDeps.dependencies = {
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        lib1Name: [],
        lib2Name: []
      };
      initialDeps.files = {
        'app1.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        'lib1.ts': [],
        'lib2.ts': []
      };
      projects = projects.filter(p => p.name !== 'lib2Name');
      const result = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
      expect(result.incrementalEnabled).toEqual(false);
      expect(result.getDeps()).toEqual({
        lib1Name: [],
        app1Name: []
      });
    });

    it('should not be incremental if projects are renamed in an existing graph', () => {
      initialDeps.dependencies = {
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        lib1Name: [],
        lib2Name: []
      };
      initialDeps.files = {
        'app1.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        'lib1.ts': [],
        'lib2.ts': []
      };
      projects = projects.map(proj => {
        if (proj.name !== 'app1Name') {
          return proj;
        }
        return {
          ...proj,
          name: 'newApp1Name'
        };
      });
      const result = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
      expect(result.incrementalEnabled).toEqual(false);
      expect(result.getDeps()).toEqual({
        newApp1Name: [],
        lib1Name: [],
        lib2Name: []
      });
    });

    it('should not be incremental if a legacy existing dependencies exists', () => {
      delete initialDeps.dependencies;
      delete initialDeps.files;
      const result = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
      expect(result.incrementalEnabled).toEqual(false);
      expect(result.getDeps()).toEqual({
        app1Name: [],
        lib1Name: [],
        lib2Name: []
      });
    });
  });

  describe('incremental', () => {
    beforeEach(() => {
      virtualFs = {
        'app1.ts': `
          const routes = {
            path: 'a', loadChildren: '@nrwl/lib1#LibModule',
            path: 'b', loadChildren: '@nrwl/lib2/deep#LibModule'
          };`
      };
      initialDeps.dependencies = {
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        lib1Name: [],
        lib2Name: [
          {
            projectName: 'lib3Name',
            type: DependencyType.es6Import
          }
        ]
      };
      initialDeps.files = {
        'app1.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.loadChildren
          },
          {
            projectName: 'lib2Name',
            type: DependencyType.loadChildren
          }
        ],
        'lib1.ts': [],
        'lib2.ts': [
          {
            projectName: 'lib1Name',
            type: DependencyType.es6Import
          }
        ]
      };
      depsCalculator = new DepsCalculator(
        'nrwl',
        projects,
        initialDeps,
        {},
        fileRead
      );
    });

    it('should be able to add edges to the graph', () => {
      virtualFs['lib1.ts'] = `import '@nrwl/lib2';`;
      depsCalculator.processFile('lib1.ts');
      const deps = depsCalculator.getDeps();
      expect(deps.lib1Name).toEqual([
        {
          projectName: 'lib2Name',
          type: DependencyType.es6Import
        }
      ]);
    });

    it('should be able to remove edges from the graph', () => {
      virtualFs['lib2.ts'] = '';
      depsCalculator.processFile('lib2.ts');
      const deps = depsCalculator.getDeps();
      expect(deps.lib2Name).toEqual([]);
    });

    it('should be able change the type of edges for the graph ', () => {
      virtualFs['app1.ts'] = `
        import { LibModule } from '@nrwl/lib1';
        import { Lib2Module } from '@nrwl/lib2';`;
      depsCalculator.processFile('app1.ts');
      const deps = depsCalculator.getDeps();
      expect(deps.app1Name).toEqual([
        {
          projectName: 'lib1Name',
          type: DependencyType.es6Import
        },
        {
          projectName: 'lib2Name',
          type: DependencyType.es6Import
        }
      ]);
    });

    it('should be able to recalculate the same edges for the graph ', () => {
      virtualFs['app1.ts'] = `
        const routes = {
          path: 'a', loadChildren: '@nrwl/lib1#LibModule',
          path: 'b', loadChildren: '@nrwl/lib2/deep#LibModule'
        };`;
      depsCalculator.processFile('app1.ts');
      const deps = depsCalculator.getDeps();
      expect(deps.app1Name).toEqual([
        {
          projectName: 'lib1Name',
          type: DependencyType.loadChildren
        },
        {
          projectName: 'lib2Name',
          type: DependencyType.loadChildren
        }
      ]);
    });
  });
});

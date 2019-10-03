import * as fs from 'fs';

import {
  DepsCalculator,
  DependencyType,
  NxDepsJson,
  dependencies
} from './deps-calculator';
import { ProjectType, ProjectNode } from './shared';
import { serializeJson } from '../utils/fileutils';

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
      depsCalculator = new DepsCalculator('nrwl', projects, null, fileRead);
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

describe('Calculates Dependencies Between Apps and Libs', () => {
  describe('dependencies', () => {
    beforeEach(() => {
      spyOn(fs, 'writeFileSync');
    });

    it('should return a graph with a key for every project', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        null,
        () => null
      );

      expect(deps).toEqual({ app1Name: [], app2Name: [] });
    });

    // NOTE: previously we did create an implicit dependency here, but that is now handled in `getProjectNodes`
    it('should not create implicit dependencies between e2e and apps', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app1Name-e2e',
            root: 'apps/app1Name-e2e',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.e2e
          }
        ],
        null,
        () => null
      );

      expect(deps).toEqual({
        app1Name: [],
        'app1Name-e2e': []
      });
    });

    it('should support providing implicit deps for e2e project with custom name', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'customName-e2e',
            root: 'apps/customName-e2e',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: ['app1Name'],
            architect: {},
            type: ProjectType.e2e
          }
        ],
        null,
        () => null
      );

      expect(deps).toEqual({
        app1Name: [],
        'customName-e2e': [
          { projectName: 'app1Name', type: DependencyType.implicit }
        ]
      });
    });

    it('should support providing implicit deps for e2e project with standard name', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app1Name-e2e',
            root: 'apps/app1Name-e2e',
            files: [],
            fileMTimes: {},
            tags: [],
            implicitDependencies: ['app2Name'],
            architect: {},
            type: ProjectType.e2e
          }
        ],
        null,
        () => null
      );

      expect(deps).toEqual({
        app1Name: [],
        app2Name: [],
        'app1Name-e2e': [
          { projectName: 'app2Name', type: DependencyType.implicit }
        ]
      });
    });

    it('should infer deps between projects based on imports', () => {
      const deps = dependencies(
        'nrwl',
        [
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
        ],
        null,
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            import '@nrwl/lib1';
            import '@nrwl/lib2/deep';
          `;
            case 'lib1.ts':
              return `import '@nrwl/lib2'`;
            case 'lib2.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ],
        lib1Name: [{ projectName: 'lib2Name', type: DependencyType.es6Import }],
        lib2Name: []
      });
    });

    it('should infer deps between projects based on exports', () => {
      const deps = dependencies(
        'nrwl',
        [
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
        ],
        null,
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            export * from '@nrwl/lib1';
            export { } from '@nrwl/lib2/deep';
          `;
            case 'lib1.ts':
              return `import '@nrwl/lib2'`;
            case 'lib2.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ],
        lib1Name: [{ projectName: 'lib2Name', type: DependencyType.es6Import }],
        lib2Name: []
      });
    });

    it('should calculate dependencies in .tsx files', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.tsx'],
            fileMTimes: {
              'app1.tsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.tsx'],
            fileMTimes: {
              'lib1.tsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.tsx'],
            fileMTimes: {
              'lib2.tsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        null,
        file => {
          switch (file) {
            case 'app1.tsx':
              return `
            import '@nrwl/lib1';
            import '@nrwl/lib2/deep';
          `;
            case 'lib1.tsx':
              return `import '@nrwl/lib2'`;
            case 'lib2.tsx':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ],
        lib1Name: [{ projectName: 'lib2Name', type: DependencyType.es6Import }],
        lib2Name: []
      });
    });

    it('should calculate dependencies in .js files', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.js'],
            fileMTimes: {
              'app1.js': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.js'],
            fileMTimes: {
              'lib1.js': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.js'],
            fileMTimes: {
              'lib2.js': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        null,
        file => {
          switch (file) {
            case 'app1.js':
              return `
            import '@nrwl/lib1';
            import '@nrwl/lib2/deep';
          `;
            case 'lib1.js':
              return `import '@nrwl/lib2'`;
            case 'lib2.js':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ],
        lib1Name: [{ projectName: 'lib2Name', type: DependencyType.es6Import }],
        lib2Name: []
      });
    });

    it('should calculate dependencies in .jsx files', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.jsx'],
            fileMTimes: {
              'app1.jsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.jsx'],
            fileMTimes: {
              'lib1.jsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.jsx'],
            fileMTimes: {
              'lib2.jsx': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        null,
        file => {
          switch (file) {
            case 'app1.jsx':
              return `
            import '@nrwl/lib1';
            import '@nrwl/lib2/deep';
          `;
            case 'lib1.jsx':
              return `import '@nrwl/lib2'`;
            case 'lib2.jsx':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ],
        lib1Name: [{ projectName: 'lib2Name', type: DependencyType.es6Import }],
        lib2Name: []
      });
    });

    it('should infer dependencies expressed via loadChildren', () => {
      const deps = dependencies(
        'nrwl',
        [
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
        ],
        null,
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            const routes = {
              path: 'a', loadChildren: '@nrwl/lib1#LibModule',
              path: 'b', loadChildren: '@nrwl/lib2/deep#LibModule'
            };
          `;
            case 'lib1.ts':
              return '';
            case 'lib2.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        app1Name: [
          { projectName: 'lib1Name', type: DependencyType.loadChildren },
          { projectName: 'lib2Name', type: DependencyType.loadChildren }
        ],
        lib1Name: [],
        lib2Name: []
      });
    });

    it('should handle non-ts files', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['index.html'],
            fileMTimes: {
              'index.html': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        null,
        () => null
      );

      expect(deps).toEqual({ app1Name: [] });
    });

    it('should handle projects with the names starting with the same string', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'aaName',
            root: 'libs/aa',
            files: ['aa.ts'],
            fileMTimes: {
              'aa.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'aaBbName',
            root: 'libs/aa/bb',
            files: ['bb.ts'],
            fileMTimes: {
              'bb.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        null,
        file => {
          switch (file) {
            case 'aa.ts':
              return `import '@nrwl/aa/bb'`;
            case 'bb.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        aaBbName: [],
        aaName: [{ projectName: 'aaBbName', type: DependencyType.es6Import }]
      });
    });

    it('should not add the same dependency twice', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'aaName',
            root: 'libs/aa',
            files: ['aa.ts'],
            fileMTimes: {
              'aa.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'bbName',
            root: 'libs/bb',
            files: ['bb.ts'],
            fileMTimes: {
              'bb.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        null,
        file => {
          switch (file) {
            case 'aa.ts':
              return `
              import '@nrwl/bb/bb'
              import '@nrwl/bb/bb'
              `;
            case 'bb.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({
        aaName: [{ projectName: 'bbName', type: DependencyType.es6Import }],
        bbName: []
      });
    });

    it('should not add a dependency on self', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'aaName',
            root: 'libs/aa',
            files: ['aa.ts'],
            fileMTimes: {
              'aa.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        null,
        file => {
          switch (file) {
            case 'aa.ts':
              return `
              import '@nrwl/aa/aa'
              `;
          }
        }
      );

      expect(deps).toEqual({ aaName: [] });
    });

    it(`should handle an ExportDeclaration w/ moduleSpecifier and w/o moduleSpecifier`, () => {
      const deps = dependencies(
        'nrwl',
        [
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
          },
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
        ],
        null,
        file => {
          switch (file) {
            case 'lib1.ts':
              return `
            const FOO = 23;
            export { FOO };
          `;
            case 'lib2.ts':
              return `
            export const BAR = 24;
          `;
            case 'lib3.ts':
              return `
              import { FOO } from '@nrwl/lib1';
              export { FOO };
              export { BAR } from '@nrwl/lib2';
            `;
          }
        }
      );

      expect(deps).toEqual({
        lib1Name: [],
        lib2Name: [],
        lib3Name: [
          { projectName: 'lib1Name', type: DependencyType.es6Import },
          { projectName: 'lib2Name', type: DependencyType.es6Import }
        ]
      });
    });
  });
});

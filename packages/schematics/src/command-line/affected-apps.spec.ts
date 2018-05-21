import {
  affectedAppNames,
  dependencies,
  DependencyType,
  ProjectType,
  touchedProjects
} from './affected-apps';

describe('Calculates Dependencies Between Apps and Libs', () => {
  describe('dependencies', () => {
    it('should return a graph with a key for every project', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: [],
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        () => null
      );

      expect(deps).toEqual({ app1Name: [], app2Name: [] });
    });

    it('should create implicit dependencies between e2e an apps', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: [],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app1Name-e2e',
            root: 'apps/app1Name-e2e',
            files: [],
            tags: [],
            architect: {},
            type: ProjectType.e2e
          }
        ],
        () => null
      );

      expect(deps).toEqual({
        app1Name: [],
        'app1Name-e2e': [
          { projectName: 'app1Name', type: DependencyType.implicit }
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
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
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

    it('should infer dependencies expressed via loadChildren', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
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
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
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
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'aaBbName',
            root: 'libs/aa/bb',
            files: ['bb.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
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
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'bbName',
            root: 'libs/bb',
            files: ['bb.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
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
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
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
  });

  describe('affectedAppNames', () => {
    it('should return the list of affected files', () => {
      const affected = affectedAppNames(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: ['app2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            import '@nrwl/lib1';
          `;
            case 'app2.ts':
              return ``;
            case 'lib1.ts':
              return `import '@nrwl/lib2'`;
            case 'lib2.ts':
              return '';
          }
        },
        ['lib2.ts']
      );

      expect(affected).toEqual(['app1Name']);
    });

    it('should return app app names if a touched file is not part of a project', () => {
      const affected = affectedAppNames(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: ['app2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            import '@nrwl/lib1';
          `;
            case 'app2.ts':
              return ``;
            case 'lib1.ts':
              return `import '@nrwl/lib2'`;
          }
        },
        ['package.json']
      );

      expect(affected).toEqual(['app2Name', 'app1Name']);
    });

    it('should handle slashes', () => {
      const affected = affectedAppNames(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['one\\app1.ts', 'two/app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        file => {
          switch (file) {
            case 'one/app1.ts':
              return '';
            case 'two/app1.ts':
              return '';
          }
        },
        ['one/app1.ts', 'two/app1.ts']
      );

      expect(affected).toEqual(['app1Name']);
    });

    it('should handle circular dependencies', () => {
      const affected = affectedAppNames(
        'nrwl',
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: ['app2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          }
        ],
        file => {
          switch (file) {
            case 'app1.ts':
              return `import '@nrwl/app2';`;
            case 'app2.ts':
              return `import '@nrwl/app1';`;
          }
        },
        ['app1.ts']
      );

      expect(affected).toEqual(['app2Name', 'app1Name']);
    });
  });

  describe('touchedProjects', () => {
    it('should return the list of touchedProjects', () => {
      const tp = touchedProjects(
        [
          {
            name: 'app1Name',
            root: 'apps/app1',
            files: ['app1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'app2Name',
            root: 'apps/app2',
            files: ['app2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'lib1Name',
            root: 'libs/lib1',
            files: ['lib1.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          },
          {
            name: 'lib2Name',
            root: 'libs/lib2',
            files: ['lib2.ts'],
            tags: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        ['lib2.ts', 'app2.ts', 'package.json']
      );

      expect(tp).toEqual(['lib2Name', 'app2Name', null]);
    });
  });
});

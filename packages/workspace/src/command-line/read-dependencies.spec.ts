import * as fs from 'fs';

import { dependencies } from './read-dependencies';
import { DependencyType, ProjectType } from './shared-models';

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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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

    it(`should handle imported node module dependencies along with project dependencies`, () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'myApp',
            root: 'apps/my-app',
            files: ['my-app.ts'],
            fileMTimes: {
              'my-app.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.app
          },
          {
            name: 'myLib',
            root: 'libs/my-lib',
            files: ['my-lib.ts'],
            fileMTimes: {
              'my-lib.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            type: ProjectType.lib
          }
        ],
        null,
        {
          dependencies: {
            rxjs: '*',
            lodash: '*'
          }
        },
        name => {
          switch (name) {
            case 'my-app.ts':
              return `
                import '@nrwl/my-lib';
                import { of } from 'rxjs';
              `;
            case 'my-lib.ts':
              return `
                import { of } from 'rxjs';
                import { get } from 'lodash';
              `;
            default:
              return '';
          }
        }
      );

      expect(deps).toEqual({
        myApp: [
          { projectName: 'myLib', type: DependencyType.es6Import },
          { projectName: 'rxjs', type: DependencyType.nodeModule }
        ],
        myLib: [
          { projectName: 'rxjs', type: DependencyType.nodeModule },
          { projectName: 'lodash', type: DependencyType.nodeModule }
        ]
      });
    });
  });
});

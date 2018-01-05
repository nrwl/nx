import { affectedApps, dependencies } from './affected-apps';

describe('Calculates Dependencies Between Apps and Libs', () => {
  describe('dependencies', () => {
    it('should return a graph with a key for every project', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1',
            files: [],
            isApp: true
          },
          {
            name: 'app2',
            files: [],
            isApp: true
          }
        ],
        () => null
      );

      expect(deps).toEqual({ app1: ['app1'], app2: ['app2'] });
    });

    it('should infer deps between projects based on imports', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'lib1',
            files: ['lib1.ts'],
            isApp: false
          },
          {
            name: 'lib2',
            files: ['lib2.ts'],
            isApp: false
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

      expect(deps).toEqual({ app1: ['app1', 'lib1', 'lib2'], lib1: ['lib1', 'lib2'], lib2: ['lib2'] });
    });

    it('should infer transitive deps between projects', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'lib1',
            files: ['lib1.ts'],
            isApp: false
          },
          {
            name: 'lib2',
            files: ['lib2.ts'],
            isApp: false
          }
        ],
        file => {
          switch (file) {
            case 'app1.ts':
              return `
            import '@nrwl/lib1';
          `;
            case 'lib1.ts':
              return `import '@nrwl/lib2'`;
            case 'lib2.ts':
              return '';
          }
        }
      );

      expect(deps).toEqual({ app1: ['app1', 'lib1', 'lib2'], lib1: ['lib1', 'lib2'], lib2: ['lib2'] });
    });

    it('should infer dependencies expressed via loadChildren', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'lib1',
            files: ['lib1.ts'],
            isApp: false
          },
          {
            name: 'lib2',
            files: ['lib2.ts'],
            isApp: false
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

      expect(deps).toEqual({ app1: ['app1', 'lib1', 'lib2'], lib1: ['lib1'], lib2: ['lib2'] });
    });

    it('should handle non-ts files', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['index.html'],
            isApp: true
          }
        ],
        () => null
      );

      expect(deps).toEqual({ app1: ['app1'] });
    });

    it('should handle projects with the names starting with the same string', () => {
      const deps = dependencies(
        'nrwl',
        [
          {
            name: 'aa',
            files: ['aa.ts'],
            isApp: true
          },
          {
            name: 'aa/bb',
            files: ['bb.ts'],
            isApp: true
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

      expect(deps).toEqual({ aa: ['aa', 'aa/bb'], 'aa/bb': ['aa/bb'] });
    });
  });

  describe('affectedApps', () => {
    it('should return the list of affected files', () => {
      const affected = affectedApps(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'app2',
            files: ['app2.ts'],
            isApp: true
          },
          {
            name: 'lib1',
            files: ['lib1.ts'],
            isApp: false
          },
          {
            name: 'lib2',
            files: ['lib2.ts'],
            isApp: false
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

      expect(affected).toEqual(['app1']);
    });

    it('should return app app names if a touched file is not part of a project', () => {
      const affected = affectedApps(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'app2',
            files: ['app2.ts'],
            isApp: true
          },
          {
            name: 'lib1',
            files: ['lib1.ts'],
            isApp: false
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

      expect(affected).toEqual(['app2', 'app1']);
    });

    it('should handle slashes', () => {
      const affected = affectedApps(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['one\\app1.ts', 'two/app1.ts'],
            isApp: true
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

      expect(affected).toEqual(['app1']);
    });

    it('should handle circular dependencies', () => {
      const affected = affectedApps(
        'nrwl',
        [
          {
            name: 'app1',
            files: ['app1.ts'],
            isApp: true
          },
          {
            name: 'app2',
            files: ['app2.ts'],
            isApp: true
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

      expect(affected).toEqual(['app2', 'app1']);
    });
  });
});

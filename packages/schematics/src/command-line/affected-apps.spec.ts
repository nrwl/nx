import { affectedAppNames, ProjectType, ProjectNode } from './affected-apps';
import { DependencyType, Deps } from './deps-calculator';
import * as fs from 'fs';

describe('affected-apps', () => {
  let deps: Deps;
  let projects: ProjectNode[];

  beforeEach(() => {
    spyOn(fs, 'writeFileSync');
    deps = {
      app1Name: [],
      app2Name: [],
      lib1Name: [],
      lib2Name: []
    };
    projects = [
      {
        name: 'app1Name',
        root: 'apps/app1',
        files: ['apps/app1/app1.ts'],
        fileMTimes: {
          'apps/app1/app1.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.app
      },
      {
        name: 'app2Name',
        root: 'apps/app2',
        files: ['apps/app2/app2.ts'],
        fileMTimes: {
          'apps/app2/app2.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.app
      },
      {
        name: 'lib1Name',
        root: 'libs/lib1',
        files: ['libs/lib1/lib1.ts'],
        fileMTimes: {
          'libs/lib1/lib1.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.lib
      },
      {
        name: 'lib2Name',
        root: 'libs/lib2',
        files: ['libs/lib2/lib2.ts'],
        fileMTimes: {
          'libs/lib2/lib2.ts': 1
        },
        tags: [],
        implicitDependencies: [],
        architect: {},
        type: ProjectType.lib
      }
    ];
  });

  describe('affectedAppNames', () => {
    it('should return the list of affected apps', () => {
      deps = {
        ...deps,
        app1Name: [
          {
            projectName: 'lib1Name',
            type: DependencyType.es6Import
          }
        ]
      };
      const affected = affectedAppNames(projects, deps, ['lib1Name']);

      expect(affected).toEqual(['app1Name']);
    });

    it('should handle circular dependencies', () => {
      deps = {
        ...deps,
        app1Name: [
          {
            projectName: 'app2Name',
            type: DependencyType.es6Import
          }
        ],
        app2Name: [
          {
            projectName: 'app1Name',
            type: DependencyType.es6Import
          }
        ]
      };
      const affected = affectedAppNames(projects, deps, ['app1Name']);

      expect(affected).toEqual(['app1Name', 'app2Name']);
    });
  });
});

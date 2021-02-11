jest.mock('../../../utilities/app-root', () => ({
  appRootPath: '/root',
}));
jest.mock('fs', () => require('memfs').fs);

import { fs, vol } from 'memfs';
import {
  AddProjectDependency,
  ProjectGraphContext,
  ProjectGraphNode,
  DependencyType,
} from '../project-graph-models';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { createFileMap } from '../../file-graph';
import { readWorkspaceFiles } from '../../file-utils';
import { appRootPath } from '../../../utilities/app-root';

describe('explicit project dependencies', () => {
  let ctx: ProjectGraphContext;
  let projects: Record<string, ProjectGraphNode>;
  let fsJson;
  beforeEach(() => {
    const workspaceJson = {
      projects: {
        proj: {
          root: 'libs/proj',
        },
        proj2: {
          root: 'libs/proj2',
        },
        proj3a: {
          root: 'libs/proj3a',
        },
        proj123: {
          root: 'libs/proj123',
        },
        proj1234: {
          root: 'libs/proj1234',
        },
        'proj1234-child': {
          root: 'libs/proj1234-child',
        },
      },
    };
    const nxJson = {
      npmScope: 'proj',
      projects: {
        proj1: {},
      },
    };
    const tsConfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@proj/proj': ['libs/proj/index.ts'],
          '@proj/my-second-proj': ['libs/proj2/index.ts'],
          '@proj/project-3': ['libs/proj3a/index.ts'],
          '@proj/proj123': ['libs/proj123/index.ts'],
          '@proj/proj1234': ['libs/proj1234/index.ts'],
          '@proj/proj1234-child': ['libs/proj1234-child/index.ts'],
        },
      },
    };
    fsJson = {
      './package.json': `{
        "name": "test",
        "dependencies": [],
        "devDependencies": []
      }`,
      './workspace.json': JSON.stringify(workspaceJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify(tsConfig),
      './libs/proj/index.ts': `import {a} from '@proj/my-second-proj';
                              import('@proj/project-3');
                              const a = { loadChildren: '@proj/proj4ab#a' };                     
      `,
      './libs/proj2/index.ts': `export const a = 2;`,
      './libs/proj3a/index.ts': `export const a = 3;`,
      './libs/proj4ab/index.ts': `export const a = 4;`,
      './libs/proj123/index.ts': 'export const a = 5',
      './libs/proj1234/index.ts': `export const a = 6 
        import { a } from '@proj/proj1234-child'
      `,
      './libs/proj1234-child/index.ts': 'export const a = 7',
      './libs/proj1234/a.b.ts': `// nx-ignore-next-line
                                 import('@proj/proj2')
                                 /* nx-ignore-next-line */
                                 import {a} from '@proj/proj3a
      `,
      './libs/proj1234/b.c.ts': `// nx-ignore-next-line
                                 require('@proj/proj4ab#a')
                                 // nx-ignore-next-line
                                 import('@proj/proj2')
                                 /* nx-ignore-next-line */
                                 import {a} from '@proj/proj3a
                                 const a = { 
                                     // nx-ignore-next-line
                                    loadChildren: '@proj/3a'
                                 }
                                 const b = {
                                    // nx-ignore-next-line
                                    loadChildren: '@proj/3a',
                                    children: [{
                                      // nx-ignore-next-line
                                      loadChildren: '@proj/proj2,
                                      // nx-ignore-next-line
                                      loadChildren: '@proj/proj3a'
                                    }]
                                 }
      `,
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspaceJson,
      nxJson,
      fileMap: createFileMap(workspaceJson, readWorkspaceFiles()),
    };

    projects = {
      proj3a: {
        name: 'proj3a',
        type: 'lib',
        data: {
          root: 'libs/proj3a',
          files: [],
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
          files: [],
        },
      },
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
          files: [],
        },
      },
      proj1234: {
        name: 'proj1234',
        type: 'lib',
        data: {
          root: 'libs/proj1234',
          files: [],
        },
      },
      proj123: {
        name: 'proj123',
        type: 'lib',
        data: {
          root: 'libs/proj123',
          files: [],
        },
      },
      proj4ab: {
        name: 'proj4ab',
        type: 'lib',
        data: {
          root: 'libs/proj4ab',
          files: [],
        },
      },
      'proj1234-child': {
        name: 'proj1234-child',
        type: 'lib',
        data: {
          root: 'libs/proj1234-child',
          files: [],
        },
      },
    };
  });

  it(`should add dependencies for projects based on file imports`, () => {
    const dependencyMap = {};
    const addDependency = jest
      .fn<ReturnType<AddProjectDependency>, Parameters<AddProjectDependency>>()
      .mockImplementation(
        (type: DependencyType, source: string, target: string) => {
          const depObj = {
            type,
            source,
            target,
          };
          if (dependencyMap[source]) {
            dependencyMap[source].push(depObj);
          } else {
            dependencyMap[source] = [depObj];
          }
        }
      );

    buildExplicitTypeScriptDependencies(ctx, projects, addDependency, (s) => {
      return fs.readFileSync(`${appRootPath}/${s}`).toString();
    });

    expect(dependencyMap).toEqual({
      proj1234: [
        {
          source: 'proj1234',
          target: 'proj1234-child',
          type: DependencyType.static,
        },
      ],
      proj: [
        {
          source: 'proj',
          target: 'proj2',
          type: DependencyType.static,
        },
        {
          source: 'proj',
          target: 'proj3a',
          type: DependencyType.dynamic,
        },
        {
          source: 'proj',
          target: 'proj4ab',
          type: DependencyType.dynamic,
        },
      ],
    });
  });
});

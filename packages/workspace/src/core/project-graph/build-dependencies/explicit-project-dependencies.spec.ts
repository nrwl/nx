import { createProjectFileMap } from '@nrwl/workspace/src/core/file-map-utils';

jest.mock('fs', () => require('memfs').fs);
jest.mock('@nrwl/tao/src/utils/app-root', () => ({
  appRootPath: '/root',
}));

import { vol } from 'memfs';
import { ProjectGraphProjectNode } from '../project-graph-models';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';
import { defaultFileHasher } from '../../hasher/file-hasher';

describe('explicit project dependencies', () => {
  let ctx: ProjectGraphProcessorContext;
  let projects: Record<string, ProjectGraphProjectNode>;
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
          '@proj/proj4ab': ['libs/proj4ab/index.ts'],
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

    defaultFileHasher.init();

    ctx = {
      workspace: {
        ...workspaceJson,
        ...nxJson,
      } as any,
      filesToProcess: createProjectFileMap(
        workspaceJson,
        defaultFileHasher.allFileData()
      ).projectFileMap,
    } as any;

    projects = {
      proj3a: {
        name: 'proj3a',
        type: 'lib',
        data: {
          root: 'libs/proj3a',
          files: [{ file: 'libs/proj3a/index.ts' }],
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
          files: [{ file: 'libs/proj2/index.ts' }],
        },
      },
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
          files: [{ file: 'libs/proj/index.ts' }],
        },
      },
      proj1234: {
        name: 'proj1234',
        type: 'lib',
        data: {
          root: 'libs/proj1234',
          files: [
            { file: 'libs/proj1234/index.ts' },
            { file: 'libs/proj1234/a.b.ts' },
            { file: 'libs/proj1234/b.c.ts' },
          ],
        },
      },
      proj123: {
        name: 'proj123',
        type: 'lib',
        data: {
          root: 'libs/proj123',
          files: [{ file: 'libs/proj123/index.ts' }],
        },
      },
      proj4ab: {
        name: 'proj4ab',
        type: 'lib',
        data: {
          root: 'libs/proj4ab',
          files: [{ file: 'libs/proj4ab/index.ts' }],
        },
      },
      'proj1234-child': {
        name: 'proj1234-child',
        type: 'lib',
        data: {
          root: 'libs/proj1234-child',
          files: [{ file: 'libs/proj1234-child/index.ts' }],
        },
      },
    };
  });

  it(`should add dependencies for projects based on file imports`, () => {
    const builder = new ProjectGraphBuilder();
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
    });

    const res = buildExplicitTypeScriptDependencies(
      ctx.workspace,
      builder.graph,
      ctx.filesToProcess
    );

    expect(res).toEqual([
      {
        sourceProjectFile: 'libs/proj/index.ts',
        sourceProjectName: 'proj',
        targetProjectName: 'proj2',
      },
      {
        sourceProjectFile: 'libs/proj/index.ts',
        sourceProjectName: 'proj',
        targetProjectName: 'proj3a',
      },
      {
        sourceProjectFile: 'libs/proj/index.ts',
        sourceProjectName: 'proj',
        targetProjectName: 'proj4ab',
      },
      {
        sourceProjectFile: 'libs/proj1234/index.ts',
        sourceProjectName: 'proj1234',
        targetProjectName: 'proj1234-child',
      },
    ]);
  });
});

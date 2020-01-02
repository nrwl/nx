import { fs, vol } from 'memfs';
import { join } from 'path';
import { ProjectGraphContext, ProjectGraphNode } from '../../project-graph';
import { findTargetProjectWithImport } from './find-target-project';

jest.mock('../../../utils/app-root', () => ({
  appRootPath: '/root'
}));
jest.mock('fs', () => require('memfs').fs);

describe('findTargetProjectWithImport', () => {
  let ctx: ProjectGraphContext;
  let projects: Record<string, ProjectGraphNode>;
  let projectNames: string[];
  let fsJson;
  beforeEach(() => {
    const workspaceJson = {
      projects: {
        proj1: {}
      }
    };
    const nxJson = {
      npmScope: 'proj',
      projects: {
        proj1: {}
      }
    };
    const tsConfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@proj/proj1': ['libs/proj1/index.ts'],
          '@proj/my-second-proj': ['libs/proj2/index.ts'],
          '@proj/project-3': ['libs/proj3/index.ts']
        }
      }
    };
    fsJson = {
      './workspace.json': JSON.stringify(workspaceJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.json': JSON.stringify(tsConfig),
      './libs/proj1/index.ts': `import {a} from '@proj/my-second-proj';
                              import('@proj/project-3');
                              const a = { loadChildren: '@proj/proj4#a' };                     
      `,
      './libs/proj2/index.ts': `export const a = 2;`,
      './libs/proj3/index.ts': `export const a = 3;`,
      './libs/proj4/index.ts': `export const a = 4;`
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspaceJson,
      nxJson,
      fileMap: {
        proj1: [
          {
            file: 'libs/proj1/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj2: [
          {
            file: 'libs/proj2/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj3: [
          {
            file: 'libs/proj3/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj4: [
          {
            file: 'libs/proj4/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ]
      }
    };
    projects = {
      proj1: {
        name: 'proj1',
        type: 'lib',
        data: {
          root: 'libs/proj1',
          files: []
        }
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
          files: []
        }
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: {
          root: 'libs/proj3',
          files: []
        }
      },
      proj4: {
        name: 'proj4',
        type: 'lib',
        data: {
          root: 'libs/proj4',
          files: []
        }
      }
    };
    projectNames = ['proj1', 'proj2', 'proj3', 'proj4'];
  });
  it('should be able to resolve a module by using tsConfig paths', () => {
    const proj2 = findTargetProjectWithImport(
      '@proj/my-second-proj',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope,
      projects,
      projectNames
    );
    const proj3 = findTargetProjectWithImport(
      '@proj/project-3',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope,
      projects,
      projectNames
    );

    expect(proj2).toEqual('proj2');
    expect(proj3).toEqual('proj3');
  });
  it('should be able to resolve a module using a normalized path', () => {
    const proj4 = findTargetProjectWithImport(
      '@proj/proj4',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope,
      projects,
      projectNames
    );

    expect(proj4).toEqual('proj4');
  });
});

import { fs, vol } from 'memfs';
import { join } from 'path';
import { ProjectGraphContext, ProjectGraphNode } from '../project-graph-models';
import { TargetProjectLocator } from './target-project-locator';

jest.mock('../../../utils/app-root', () => ({
  appRootPath: '/root'
}));
jest.mock('fs', () => require('memfs').fs);

describe('findTargetProjectWithImport', () => {
  let ctx: ProjectGraphContext;
  let projects: Record<string, ProjectGraphNode>;
  let fsJson;
  let targetProjectLocator: TargetProjectLocator;
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
          '@proj/project-3': ['libs/proj3/index.ts'],
          '@proj/proj123': ['libs/proj123/index.ts'],
          '@proj/proj1234': ['libs/proj1234/index.ts'],
          '@proj/proj1234-child': ['libs/proj1234-child/index.ts']
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
      './libs/proj4/index.ts': `export const a = 4;`,
      './libs/proj123/index.ts': 'export const a = 5',
      './libs/proj1234/index.ts': 'export const a = 6',
      './libs/proj1234-child/index.ts': 'export const a = 7'
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
        ],
        proj123: [
          {
            file: 'libs/proj123/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj1234: [
          {
            file: 'libs/proj1234/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        'proj1234-child': [
          {
            file: 'libs/proj1234-child/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ]
      }
    };

    // these projects should be in a random order
    projects = {
      proj4: {
        name: 'proj4',
        type: 'lib',
        data: {
          root: 'libs/proj4',
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
      proj1: {
        name: 'proj1',
        type: 'lib',
        data: {
          root: 'libs/proj1',
          files: []
        }
      },
      proj1234: {
        name: 'proj1234',
        type: 'lib',
        data: {
          root: 'libs/proj1234',
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
      proj123: {
        name: 'proj123',
        type: 'lib',
        data: {
          root: 'libs/proj123',
          files: []
        }
      },
      'proj1234-child': {
        name: 'proj1234-child',
        type: 'lib',
        data: {
          root: 'libs/proj1234-child',
          files: []
        }
      }
    };

    targetProjectLocator = new TargetProjectLocator(projects);
  });
  it('should be able to resolve a module by using tsConfig paths', () => {
    const proj2 = targetProjectLocator.findProjectWithImport(
      '@proj/my-second-proj',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );
    const proj3 = targetProjectLocator.findProjectWithImport(
      '@proj/project-3',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );

    expect(proj2).toEqual('proj2');
    expect(proj3).toEqual('proj3');
  });
  it('should be able to resolve a module using a normalized path', () => {
    const proj4 = targetProjectLocator.findProjectWithImport(
      '@proj/proj4',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );

    expect(proj4).toEqual('proj4');
  });
  it('should be able to resolve paths that have similar names', () => {
    const proj = targetProjectLocator.findProjectWithImport(
      '@proj/proj123',
      '',
      ctx.nxJson.npmScope
    );
    expect(proj).toEqual('proj123');

    const childProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234-child',
      '',
      ctx.nxJson.npmScope
    );
    expect(childProj).toEqual('proj1234-child');

    const parentProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234',
      '',
      ctx.nxJson.npmScope
    );
    expect(parentProj).toEqual('proj1234');
  });
});

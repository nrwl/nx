import { fs, vol } from 'memfs';
import {
  ProjectGraphContext,
  ProjectGraphNode,
} from './project-graph/project-graph-models';
import { TargetProjectLocator } from './target-project-locator';

jest.mock('../utilities/app-root', () => ({
  appRootPath: '/root',
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
        proj1: {},
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
      './libs/proj1234/index.ts': 'export const a = 6',
      './libs/proj1234-child/index.ts': 'export const a = 7',
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspaceJson,
      nxJson,
      fileMap: {
        proj: [
          {
            file: 'libs/proj/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        proj2: [
          {
            file: 'libs/proj2/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        proj3a: [
          {
            file: 'libs/proj3a/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        proj4ab: [
          {
            file: 'libs/proj4ab/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        proj123: [
          {
            file: 'libs/proj123/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        proj1234: [
          {
            file: 'libs/proj1234/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
        'proj1234-child': [
          {
            file: 'libs/proj1234-child/index.ts',
            hash: 'some-hash',
            ext: '.ts',
          },
        ],
      },
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
      'npm:@ng/core': {
        name: 'npm:@ng/core',
        type: 'npm',
        data: {
          files: [],
          packageName: '@ng/core',
        },
      },
      'npm:@ng/common': {
        name: 'npm:@ng/common',
        type: 'npm',
        data: {
          files: [],
          packageName: '@ng/common',
        },
      },
      'npm:npm-package': {
        name: 'npm:npm-package',
        type: 'npm',
        data: {
          files: [],
          packageName: 'npm-package',
        },
      },
      'npm:@proj/proj123-base': {
        name: 'npm:@proj/proj123-base',
        type: 'npm',
        data: {
          files: [],
          packageName: '@proj/proj123-base',
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

    targetProjectLocator = new TargetProjectLocator(projects);
  });

  it('should be able to resolve a module by using relative paths', () => {
    const res1 = targetProjectLocator.findProjectWithImport(
      './class.ts',
      'libs/proj/index.ts',
      ctx.nxJson.npmScope
    );
    const res2 = targetProjectLocator.findProjectWithImport(
      '../index.ts',
      'libs/proj/src/index.ts',
      ctx.nxJson.npmScope
    );
    const res3 = targetProjectLocator.findProjectWithImport(
      '../proj/../proj2/index.ts',
      'libs/proj/index.ts',
      ctx.nxJson.npmScope
    );
    const res4 = targetProjectLocator.findProjectWithImport(
      '../proj/../index.ts',
      'libs/proj/src/index.ts',
      ctx.nxJson.npmScope
    );

    expect(res1).toEqual('proj');
    expect(res2).toEqual('proj');
    expect(res3).toEqual('proj2');
    expect(res4).toEqual('proj');
  });

  it('should be able to resolve a module by using tsConfig paths', () => {
    const proj2 = targetProjectLocator.findProjectWithImport(
      '@proj/my-second-proj',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );
    const proj3a = targetProjectLocator.findProjectWithImport(
      '@proj/project-3',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );

    expect(proj2).toEqual('proj2');
    expect(proj3a).toEqual('proj3a');
  });

  it('should be able to npm dependencies', () => {
    const result1 = targetProjectLocator.findProjectWithImport(
      '@ng/core',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );
    const result2 = targetProjectLocator.findProjectWithImport(
      'npm-package',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );

    expect(result1).toEqual('npm:@ng/core');
    expect(result2).toEqual('npm:npm-package');
  });

  it('should be able to resolve a module using a normalized path', () => {
    const proj4ab = targetProjectLocator.findProjectWithImport(
      '@proj/proj4ab',
      'libs/proj1/index.ts',
      ctx.nxJson.npmScope
    );

    expect(proj4ab).toEqual('proj4ab');
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

  it('should be able to resolve npm projects', () => {
    const similarImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base',
      'libs/proj/index.ts',
      ctx.nxJson.npmScope
    );
    expect(similarImportFromNpm).toEqual('npm:@proj/proj123-base');

    const similarDeepImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base/deep',
      'libs/proj/index.ts',
      ctx.nxJson.npmScope
    );
    expect(similarDeepImportFromNpm).toEqual('npm:@proj/proj123-base');
  });
});

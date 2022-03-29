import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { vol } from 'memfs';
import { createProjectFileMap } from '../../file-map-utils';
import { defaultFileHasher } from 'nx/src/core/hasher/file-hasher';
import {
  ProjectGraphProcessorContext,
  ProjectGraphProjectNode,
} from 'nx/src/shared/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  appRootPath: '/root',
  workspaceRoot: '/root',
}));

describe('explicit package json dependencies', () => {
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
        proj3: {
          root: 'libs/proj3',
        },
        proj4: {
          root: 'libs/proj4',
        },
      },
    };

    const nxJson = {
      npmScope: 'proj',
    };

    fsJson = {
      './package.json': `{
        "name": "test",
        "dependencies": [],
        "devDependencies": []
      }`,
      './workspace.json': JSON.stringify(workspaceJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify({}),
      './libs/proj2/package.json': JSON.stringify({ name: 'proj2' }),
      './libs/proj3/package.json': JSON.stringify({ name: 'proj3' }),
      './libs/proj/package.json': JSON.stringify({
        dependencies: { proj2: '*', external: '12.0.0' },
        devDependencies: { proj3: '*' },
      }),
    };
    vol.fromJSON(fsJson, '/root');

    defaultFileHasher.init();

    ctx = {
      workspace: {
        projects: {
          proj2: {
            root: 'libs/proj2',
          },
          proj3: {
            root: 'libs/proj3',
          },
        },
        workspaceJson,
        nxJson,
      },
      filesToProcess: createProjectFileMap(
        workspaceJson,
        defaultFileHasher.allFileData()
      ).projectFileMap,
    } as any;

    projects = {
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
          files: [{ file: 'libs/proj/package.json' } as any],
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: { root: 'libs/proj2', files: [] },
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: { root: 'libs/proj4', files: [] },
      },
    };
  });

  it(`should add dependencies for projects based on deps in package.json`, () => {
    const builder = new ProjectGraphBuilder();
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:external',
      data: {
        version: '12.0.0',
        packageName: 'external',
      },
    });

    const res = buildExplicitPackageJsonDependencies(
      ctx.workspace,
      builder.graph,
      ctx.filesToProcess
    );

    expect(res).toEqual([
      {
        sourceProjectName: 'proj',
        targetProjectName: 'proj2',
        sourceProjectFile: 'libs/proj/package.json',
      },
      {
        sourceProjectFile: 'libs/proj/package.json',
        sourceProjectName: 'proj',
        targetProjectName: 'npm:external',
      },
      {
        sourceProjectName: 'proj',
        targetProjectName: 'proj3',
        sourceProjectFile: 'libs/proj/package.json',
      },
    ]);
  });
});

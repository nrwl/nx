import { buildExplicitPackageJsonDependencies } from '@nrwl/workspace/src/core/project-graph/build-dependencies/explicit-package-json-dependencies';
import { vol } from 'memfs';
import { ProjectGraphNode } from '../project-graph-models';
import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';
import { createProjectFileMap } from '../../file-utils';

jest.mock('fs', () => require('memfs').fs);
jest.mock('@nrwl/tao/src/utils/app-root', () => ({
  appRootPath: '/root',
}));

describe('explicit package json dependencies', () => {
  let ctx: ProjectGraphProcessorContext;
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
      './libs/proj/package.json': JSON.stringify({
        dependencies: { proj2: '*' },
        devDependencies: { proj3: '*' },
      }),
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspace: {
        workspaceJson,
        nxJson,
      },
      filesToProcess: createProjectFileMap(workspaceJson).projectFileMap,
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
        data: { files: [] },
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: { files: [] },
      },
    };
  });

  it(`should add dependencies for projects based on deps in package.json`, () => {
    const builder = new ProjectGraphBuilder();
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
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
        sourceProjectName: 'proj',
        targetProjectName: 'proj3',
        sourceProjectFile: 'libs/proj/package.json',
      },
    ]);
  });
});

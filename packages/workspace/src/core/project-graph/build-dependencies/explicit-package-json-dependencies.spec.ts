import { buildExplicitPackageJsonDependencies } from '@nrwl/workspace/src/core/project-graph/build-dependencies/explicit-package-json-dependencies';
import { vol } from 'memfs';
import { DependencyType, ProjectGraphNode } from '../project-graph-models';
import { createProjectFileMap } from '../../file-graph';
import { readWorkspaceFiles } from '../../file-utils';
import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';

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
      projects: {
        proj1: {},
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
      filesToProcess: createProjectFileMap(workspaceJson, readWorkspaceFiles()),
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

    buildExplicitPackageJsonDependencies(ctx, builder);

    expect(builder.getUpdatedProjectGraph().dependencies).toEqual({
      proj: [
        {
          source: 'proj',
          target: 'proj2',
          type: DependencyType.static,
        },
        {
          source: 'proj',
          target: 'proj3',
          type: DependencyType.static,
        },
      ],
      proj2: [],
      proj3: [],
    });
  });
});

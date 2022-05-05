import { buildExecutorDependencies } from './build-executor-dependencies';
import { vol } from 'memfs';
import { createProjectFileMap } from '../file-map-utils';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { ProjectGraphBuilder } from '../project-graph-builder';
import {
  ProjectGraphProcessorContext,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { WorkspaceJsonConfiguration } from 'nx/src/config/workspace-json-project-json';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  workspaceRoot: '/root',
}));

describe('explicit executor dependencies', () => {
  let ctx: ProjectGraphProcessorContext;
  let projects: Record<string, ProjectGraphProjectNode>;
  let npmPackages: ProjectGraphExternalNode[];
  let fsJson;

  beforeEach(() => {
    const workspaceJson: WorkspaceJsonConfiguration = {
      version: 2,
      projects: {
        project: {
          root: 'libs/project',
          targets: {
            build: {
              executor: '@local/plugin:build',
            },
            test: {
              executor: '@nrwl/jest:jest',
            },
          },
        },
        plugin: {
          root: 'libs/plugin',
        },
      },
    };

    const nxJson = {
      npmScope: 'local',
    };

    fsJson = {
      './package.json': `{
        "name": "test",
        "dependencies": [],
        "devDependencies": []
      }`,
      './workspace.json': JSON.stringify(workspaceJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@local/plugin': ['./libs/plugin/index.ts'],
            '@local/library': ['./libs/project/index.ts'],
          },
        },
      }),
      './libs/plugin/package.json': JSON.stringify({
        name: '@local/plugin',
      }),
    };
    vol.fromJSON(fsJson, '/root');

    defaultFileHasher.init();

    ctx = {
      workspace: {
        ...workspaceJson,
        ...nxJson,
      },
      fileMap: createProjectFileMap(
        workspaceJson,
        defaultFileHasher.allFileData()
      ).projectFileMap,
    } as any;

    projects = {
      plugin: {
        name: 'plugin',
        type: 'lib',
        data: {
          root: 'libs/plugin',
          files: [{ file: 'libs/plugin/package.json' } as any],
        },
      },
      project: {
        name: 'project',
        type: 'lib',
        data: { root: 'libs/project', files: [] },
      },
    };

    npmPackages = [
      {
        type: 'npm',
        name: `npm:@nrwl/jest`,
        data: {
          version: '0.0.1',
          packageName: '@nrwl/jest',
        },
      },
    ];
  });

  it(`should add dependencies for projects based on executors used in project configuration`, () => {
    const builder = new ProjectGraphBuilder();
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
    });
    npmPackages.forEach((p) => builder.addExternalNode(p));

    buildExecutorDependencies(ctx, builder);

    const res = builder.getUpdatedProjectGraph();

    expect(res.dependencies['project']).toEqual([
      {
        source: 'project',
        target: 'plugin',
        type: 'implicit',
      },
      {
        source: 'project',
        target: 'npm:@nrwl/jest',
        type: 'implicit',
      },
    ]);
  });
});

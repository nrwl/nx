import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { createBabelrcForWorkspaceLibs } from './create-babelrc-for-workspace-libs';
import {
  DependencyType,
  ProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/workspace/src/core/project-graph', () => ({
  ...jest.requireActual('@nrwl/workspace/src/core/project-graph'),
  createProjectGraph: jest.fn().mockImplementation(() => projectGraph),
}));

describe('Create missing .babelrc files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should create .babelrc files for libs that are used in '@nrwl/web:build'`, async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          webapp: {
            root: 'apps/webapp',
            projectType: 'application',
            targets: {
              build: { executor: '@nrwl/web:build' },
            },
          },
          nodeapp: {
            root: 'apps/nodeapp',
            projectType: 'application',
            targets: {
              build: { executor: '@nrwl/node:build' },
            },
          },
          weblib: {
            root: 'libs/weblib',
            projectType: 'library',
          },
          nodelib: {
            root: 'libs/nodelib',
            projectType: 'library',
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        npmScope: 'proj',
        projects: {
          webapp: {},
          nodeapp: {},
          weblib: {},
          nodelib: {},
        },
      })
    );
    tree.write('apps/webapp/index.ts', `import '@proj/weblib';`);

    projectGraph = {
      nodes: {
        webapp: {
          name: 'webapp',
          type: 'app',
          data: {
            files: [],
            root: 'apps/webapp',
          },
        },
        nodeapp: {
          name: 'nodeapp',
          type: 'app',
          data: {
            files: [],
            root: 'apps/nodeapp',
          },
        },
        weblib: {
          name: 'weblib',
          type: 'lib',
          data: {
            files: [],
            root: 'libs/weblib',
          },
        },
        nodelib: {
          name: 'nodelib',
          type: 'lib',
          data: {
            files: [],
            root: 'libs/nodelib',
          },
        },
      },
      dependencies: {
        webapp: [
          {
            type: DependencyType.static,
            source: 'webapp',
            target: 'weblib',
          },
        ],
      },
    };

    await createBabelrcForWorkspaceLibs(tree);

    expect(readJson(tree, 'libs/weblib/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(tree.exists('libs/nodelib/.babelrc')).toBeFalsy();
  });
});

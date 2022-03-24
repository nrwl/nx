import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, writeJson, DependencyType } from '@nrwl/devkit';
import { createBabelrcForWorkspaceLibs } from './create-babelrc-for-workspace-libs';
import type { ProjectGraph, Tree } from '@nrwl/devkit';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('Create missing .babelrc files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should create .babelrc files for libs that are used in '@nrwl/web:build'`, async () => {
    writeJson(tree, 'workspace.json', {
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
    });
    writeJson(tree, 'nx.json', {
      npmScope: 'proj',
      projects: {
        webapp: {},
        nodeapp: {},
        weblib: {},
        nodelib: {},
      },
    });
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

  it('should not error if there are circular dependencies', async () => {
    writeJson(tree, 'workspace.json', {
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
    });
    writeJson(tree, 'nx.json', {
      npmScope: 'proj',
      projects: {
        webapp: {},
        nodeapp: {},
        weblib: {},
        nodelib: {},
      },
    });
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
        nodelib2: {
          name: 'nodelib2',
          type: 'lib',
          data: {
            files: [],
            root: 'libs/nodelib2',
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
        nodelib: [
          {
            type: DependencyType.static,
            source: 'nodelib',
            target: 'nodelib2',
          },
        ],
        nodelib2: [
          {
            type: DependencyType.static,
            source: 'nodelib2',
            target: 'nodelib',
          },
        ],
      },
    };

    await createBabelrcForWorkspaceLibs(tree);

    expect(readJson(tree, 'libs/weblib/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(tree.exists('libs/nodelib/.babelrc')).toBeFalsy();
    expect(tree.exists('libs/nodelib2/.babelrc')).toBeFalsy();
  });
});

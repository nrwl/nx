import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { createBabelrcForWorkspaceLibs } from './create-babelrc-for-workspace-libs';

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

    await createBabelrcForWorkspaceLibs(tree);

    expect(readJson(tree, 'libs/weblib/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(tree.exists('libs/nodelib/.babelrc')).toBeFalsy();
  });
});

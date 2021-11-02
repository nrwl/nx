import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addJsInclude from './add-js-include-11-6-0';

describe('Add js include 11.6.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add js patterns to tsconfig "include"', async () => {
    writeJson(tree, 'workspace.json', {
      projects: {
        app1: {
          root: 'apps/app1',
          targets: {
            build: {
              executor: '@nrwl/next:build',
            },
          },
        },
      },
    });

    writeJson(tree, 'nx.json', {
      projects: {
        app1: {},
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.json', {
      include: ['**/*.ts'],
    });

    await addJsInclude(tree);

    expect(readJson(tree, 'apps/app1/tsconfig.json')).toMatchObject({
      include: ['**/*.ts', '**/*.js', '**/*.jsx'],
    });
  });
});

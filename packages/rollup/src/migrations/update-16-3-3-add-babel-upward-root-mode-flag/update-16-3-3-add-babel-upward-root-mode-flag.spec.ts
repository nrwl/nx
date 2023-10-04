import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import addBabelUpwardRootModeFlag from './update-16-3-3-add-babel-upward-root-mode-flag';

describe('16.3.0 migration (add babelUpwardRootMode flag)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add the babelUpwardRootMode flag to rollup projects', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {},
        },
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {
            babelUpwardRootMode: false,
          },
        },
      },
    });

    addProjectConfiguration(tree, 'app3', {
      root: 'apps/app3',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {},
        },
      },
    });

    await addBabelUpwardRootModeFlag(tree);

    const app1 = readProjectConfiguration(tree, 'app1');
    const app2 = readProjectConfiguration(tree, 'app2');
    const app3 = readProjectConfiguration(tree, 'app3');

    expect(app1.targets['build'].options.babelUpwardRootMode).toBeTruthy();
    expect(app2.targets['build'].options.babelUpwardRootMode).toBeFalsy();
    expect(app3.targets['build'].options.babelUpwardRootMode).toBeUndefined();
  });
});

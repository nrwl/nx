import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import addBabelUpwardRootModeFlag from './add-babelUpwardRootMode-flag';

describe('15.7.2 migration (add babelUpwardRootMode flag)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add the babelUpwardRootMode flag to webpack projects', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {},
        },
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
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
          executor: '@nrwl/vite:build',
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

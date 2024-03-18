import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import update from './remove-es2015-polyfills-option';

describe('15.4.5 migration (remove es2015-polyfills)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update all executors using @nrwl/webpack:webpack and es2015Polyfills option', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            es2015Polyfills: 'app1/polyfills.ts',
          },
        },
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            es2016Polyfills: 'app2/polyfills.ts',
          },
        },
      },
    });
    addProjectConfiguration(tree, 'app3', {
      root: 'app3',
      targets: {
        custom: {
          executor: '@foo/bar:faz',
          options: {
            es2015Polyfills: 'app3/polyfills.ts',
          },
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.options
        .es2015Polyfills
    ).toBeUndefined();
    expect(
      readProjectConfiguration(tree, 'app2').targets.custom.options
        .es2015Polyfills
    ).toBeUndefined();
    // Another executor, left intact.
    expect(
      readProjectConfiguration(tree, 'app3').targets.custom.options
        .es2015Polyfills
    ).toEqual('app3/polyfills.ts');
  });
});

import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-web-configuration';

describe('add-web-configuration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nx/react-native:start',
          options: {},
        },
        serve: {
          executor: 'nx:run-commands',
          options: {
            command: 'nx start product',
          },
        },
      },
    });
  });

  it(`should add web configuration`, async () => {
    await update(tree);

    tree.exists('apps/product/webpack.config.js');
    getProjects(tree).forEach((project) => {
      expect(project.targets['build'].executor).toEqual('@nx/webpack:webpack');
      expect(project.targets['serve'].executor).toEqual(
        '@nx/webpack:dev-server'
      );
    });
  });
});

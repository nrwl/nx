import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, Tree } from '@nx/devkit';
import webpackConfigSetup from './webpack-config-setup';

describe('17.2.1 migration (setup webpack.config file)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it.each`
    executor
    ${'@nx/webpack:webpack'}
    ${'@nrwl/webpack:webpack'}
  `(
    'should create webpack.config.js for projects that did not set webpackConfig',
    async ({ executor }) => {
      addProjectConfiguration(tree, 'myapp', {
        root: 'apps/myapp',
        targets: {
          build: {
            executor,
            options: {},
          },
        },
      });

      await webpackConfigSetup(tree);

      expect(tree.read('apps/myapp/webpack.config.js', 'utf-8'))
        .toEqual(`const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
  // See: https://nx.dev/recipes/webpack/webpack-config-setup
  return config;
});
`);
    }
  );

  it('should not create webpack.config.js when webpackConfig is already set', async () => {
    tree.write(
      `apps/myapp/webpack.config.js`,
      `
      module.exports = { /* CUSTOM */ };
    `
    );
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: 'apps/myapp/webpack.config.js',
          },
        },
      },
    });

    await webpackConfigSetup(tree);

    expect(tree.read('apps/myapp/webpack.config.js', 'utf-8')).toContain(
      '/* CUSTOM */'
    );
  });

  it('should not create webpack.config.js when isolatedConfig is set to false', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            // Technically this is not possible, since isolatedConfig without webpackConfig does not work
            // Handling this edge-case anyway
            isolatedConfig: false,
          },
        },
      },
    });

    await webpackConfigSetup(tree);

    expect(tree.exists('apps/myapp/webpack.config.js')).toBeFalsy();
  });
});

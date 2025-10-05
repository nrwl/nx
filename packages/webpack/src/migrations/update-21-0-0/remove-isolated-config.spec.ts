import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import update from './remove-isolated-config';

describe('21.0.0 - remove isolatedConfig option', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should create webpack.config.js for projects that did not set webpackConfig', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            // This option will be removed
            isolatedConfig: false,
          },
        },
      },
    });

    await update(tree);

    const project = readProjectConfiguration(tree, 'myapp');
    expect(tree.read('apps/myapp/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/webpack');

      // Nx plugins for webpack.
      module.exports = composePlugins(withNx(), (config) => {
        // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
        // See: https://nx.dev/recipes/webpack/webpack-config-setup
        return config;
      });
      "
    `);
    expect(project.targets.build.options).toEqual({
      webpackConfig: 'apps/myapp/webpack.config.js',
    });
  });

  it('should create webpack.config.js for projects using `target: web`', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            target: 'web',
            // This option will be removed
            isolatedConfig: false,
          },
        },
      },
    });

    await update(tree);

    const project = readProjectConfiguration(tree, 'myapp');
    expect(tree.read('apps/myapp/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { composePlugins, withNx, withWeb } = require('@nx/webpack');

      // Nx plugins for webpack.
      module.exports = composePlugins(withNx(), withWeb(), (config) => {
        // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
        // See: https://nx.dev/recipes/webpack/webpack-config-setup
        return config;
      });
      "
    `);
    expect(project.targets.build.options).toEqual({
      target: 'web',
      webpackConfig: 'apps/myapp/webpack.config.js',
    });
  });

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
          executor: '@nx/webpack:webpack',
          options: {
            webpackConfig: 'apps/myapp/webpack.config.js',
          },
        },
      },
    });

    await update(tree);

    expect(tree.read('apps/myapp/webpack.config.js', 'utf-8')).toContain(
      '/* CUSTOM */'
    );
  });
});

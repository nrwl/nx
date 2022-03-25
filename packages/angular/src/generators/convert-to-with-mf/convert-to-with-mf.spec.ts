import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  STANDARD_HOST_MFE_CONFIG,
  STANDARD_REMOTE_MFE_CONFIG,
  OLD_OBJECT_SHARED_SYNTAX,
  ERROR_NAME_DOESNT_MATCH,
  ERROR_SHARED_PACKAGES_DOESNT_MATCH,
} from './convert-to-with-mf.test-data';
import convertToWithMF from './convert-to-with-mf';

describe('convertToWithMF', () => {
  it('should migrate a standard previous generated host config correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'host1', {
      name: 'host1',
      root: 'apps/host1',
      sourceRoot: 'apps/host1/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'apps/host1/webpack.config.js',
            },
          },
        },
      },
    });

    tree.write('apps/host1/webpack.config.js', STANDARD_HOST_MFE_CONFIG);

    // ACT
    await convertToWithMF(tree, {
      project: 'host1',
    });

    // ASSERT
    const webpackSource = tree.read('apps/host1/webpack.config.js', 'utf-8');
    expect(webpackSource).toMatchSnapshot();
  });

  it('should migrate a standard previous generated remote config correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'remote1', {
      name: 'remote1',
      root: 'apps/remote1',
      sourceRoot: 'apps/remote1/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'apps/remote1/webpack.config.js',
            },
          },
        },
      },
    });

    tree.write('apps/remote1/webpack.config.js', STANDARD_REMOTE_MFE_CONFIG);

    // ACT
    await convertToWithMF(tree, {
      project: 'remote1',
    });

    // ASSERT
    const webpackSource = tree.read('apps/remote1/webpack.config.js', 'utf-8');
    expect(webpackSource).toMatchSnapshot();
  });

  it('should migrate a standard previous generated remote config using object shared syntax correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'remote1', {
      name: 'remote1',
      root: 'apps/remote1',
      sourceRoot: 'apps/remote1/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'apps/remote1/webpack.config.js',
            },
          },
        },
      },
    });

    tree.write('apps/remote1/webpack.config.js', OLD_OBJECT_SHARED_SYNTAX);

    // ACT
    await convertToWithMF(tree, {
      project: 'remote1',
    });

    // ASSERT
    const webpackSource = tree.read('apps/remote1/webpack.config.js', 'utf-8');
    expect(webpackSource).toMatchSnapshot();
  });

  it('should throw when the uniqueName doesnt match the project name', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'remote1', {
      name: 'remote1',
      root: 'apps/remote1',
      sourceRoot: 'apps/remote1/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'apps/remote1/webpack.config.js',
            },
          },
        },
      },
    });

    tree.write('apps/remote1/webpack.config.js', ERROR_NAME_DOESNT_MATCH);

    // ACT & ASSERT
    await expect(
      convertToWithMF(tree, {
        project: 'remote1',
      })
    ).rejects.toThrow();
  });

  it('should throw when the shared npm packages configs has been modified', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'host1', {
      name: 'host1',
      root: 'apps/host1',
      sourceRoot: 'apps/host1/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'apps/host1/webpack.config.js',
            },
          },
        },
      },
    });

    tree.write(
      'apps/host1/webpack.config.js',
      ERROR_SHARED_PACKAGES_DOESNT_MATCH
    );

    // ACT & ASSERT
    await expect(
      convertToWithMF(tree, {
        project: 'host1',
      })
    ).rejects.toThrow();
  });
});

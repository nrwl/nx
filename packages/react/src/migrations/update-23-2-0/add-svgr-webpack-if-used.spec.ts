import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrWebpackIfUsed from './add-svgr-webpack-if-used';

describe('add-svgr-webpack-if-used migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { '@nx/react': '23.1.0' };
      return json;
    });
  });

  it('should not add @svgr/webpack when no webpack config references it', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { webpackConfig: 'apps/app1/webpack.config.js' },
        },
      },
    });
    tree.write('apps/app1/webpack.config.js', 'module.exports = {};');

    await addSvgrWebpackIfUsed(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      '@nx/react': '23.1.0',
    });
  });

  it('should add @svgr/webpack when a webpack config referenced by a target resolves it', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { webpackConfig: 'apps/app1/custom.webpack.js' },
        },
      },
    });
    tree.write(
      'apps/app1/custom.webpack.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBeDefined();
  });

  it('should find webpack configs referenced only by a target configuration', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          configurations: {
            production: { webpackConfig: 'apps/app1/webpack.config.prod.js' },
          },
        },
      },
    });
    tree.write(
      'apps/app1/webpack.config.prod.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBeDefined();
  });

  it('should find a conventional webpack config on a project with no executor targets', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {},
    });
    tree.write(
      'apps/app1/webpack.config.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBeDefined();
  });

  it('should leave an already installed @svgr/webpack untouched', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@svgr/webpack'] = '^7.0.0';
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {},
    });
    tree.write(
      'apps/app1/webpack.config.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBe('^7.0.0');
  });
});

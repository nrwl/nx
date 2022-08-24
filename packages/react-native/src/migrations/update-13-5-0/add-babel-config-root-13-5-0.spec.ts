import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './add-babel-config-root-13-5-0';

describe('Add react-native-svg to dev dependencies', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/react-native:start',
          options: {
            port: 8081,
          },
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });
  });

  it(`should add babel.config.json at root`, async () => {
    await update(tree);

    const babelConfigJson = readJson(tree, 'babel.config.json');
    expect(babelConfigJson).toEqual({
      babelrcRoots: ['*'],
    });
  });

  it(`should not change babel.config.json if it already exists`, async () => {
    tree.write('babel.config.json', '{}');

    await update(tree);

    const babelConfigJson = readJson(tree, 'babel.config.json');
    expect(babelConfigJson).toEqual({});
  });
});

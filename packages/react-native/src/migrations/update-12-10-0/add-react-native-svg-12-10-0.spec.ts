import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
} from '../../utils/versions';
import update from './add-react-native-svg-12-10-0';

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

  it(`should add react-native-svg to app's tsconfig.json and package.json`, async () => {
    tree.write('apps/products/tsconfig.json', '{}');
    tree.write(
      'apps/products/package.json',
      JSON.stringify({
        dependencies: {},
      })
    );
    tree.write(
      'apps/products/jest.config.js',
      `module.exports = {
      preset: 'react-native',
    };`
    );
    await update(tree);

    const tsconfig = readJson(tree, 'apps/products/tsconfig.json');
    expect(tsconfig.files).toEqual([
      '../../node_modules/@nrwl/react-native/typings/svg.d.ts',
    ]);

    const packageJson = readJson(tree, 'apps/products/package.json');
    expect(packageJson.dependencies).toEqual({ 'react-native-svg': '*' });

    const jestConfig = tree.read('apps/products/jest.config.js', 'utf-8');
    expect(jestConfig).toContain(
      `moduleNameMapper: {'\\.svg': '@nrwl/react-native/plugins/jest/svg-mock'},`
    );
  });

  it(`should not add react-native-svg to app's tsconfig.json and package.json if files do not exist`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: { 'react-native': '*' },
        devDependencies: {},
      })
    );

    await update(tree);

    expect(() => readJson(tree, 'apps/products/tsconfig.json')).toThrow();
    expect(() => readJson(tree, 'apps/products/package.json')).toThrow();
  });
});

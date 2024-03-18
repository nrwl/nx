import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-jest-preset';

describe('Change expo jest preset', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (packageJson) => {
      packageJson.devDependencies['jest-expo'] = '*';
      return packageJson;
    });
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products/jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });
  });

  it(`should not remove transfrom if the code does not contain existing preprocessor`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
      preset: 'jest-expo',
    };`
    );
    await update(tree);

    const jestConfig = tree.read('apps/products/jest.config.ts', 'utf-8');
    expect(jestConfig).toContain(`preset: 'react-native'`);
  });

  it(`should remove transform if the code contains existing preprocessor`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
        preset: 'jest-expo',
        testRunner: 'jest-jasmine2',
        transform: {
          '\\.(js|ts|tsx)$': require.resolve('react-native/jest/preprocessor.js'),
          '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
            'react-native/jest/assetFileTransformer.js'
          ),
        }
      };`
    );
    await update(tree);

    const jestConfig = tree.read('apps/products/jest.config.ts', 'utf-8');
    expect(jestConfig).not.toContain('transfrom');
    expect(jestConfig).not.toContain('testRunner');
  });

  it(`should rename .babelrc to babel.config.json`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
      preset: 'jest-expo',
    };`
    );
    tree.write(
      'apps/products/.babelrc',
      `{
        "presets": ["module:metro-react-native-babel-preset"]
      }`
    );
    await update(tree);

    expect(tree.exists('apps/products/.babelrc')).toBeFalsy();
    expect(tree.exists('apps/products/babel.config.json')).toBeTruthy();
    const babelConfigJson = tree.read(
      'apps/products/babel.config.json',
      'utf-8'
    );
    expect(babelConfigJson).toContain(
      `"presets": ["module:metro-react-native-babel-preset"]`
    );
  });

  it(`should not rename .babelrc to babel.config.json if app is not react native`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
      preset: 'other',
    };`
    );
    tree.write(
      'apps/products/.babelrc',
      `{
        "presets": ["module:metro-react-native-babel-preset"]
      }`
    );
    await update(tree);

    expect(tree.exists('apps/products/.babelrc')).toBeTruthy();
    expect(tree.exists('apps/products/babel.config.json')).toBeFalsy();
  });

  it('should remove jest-expo from package.json', async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
      preset: 'jest-expo',
    };`
    );
    await update(tree);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['jest-expo']).toBeUndefined();
  });
});

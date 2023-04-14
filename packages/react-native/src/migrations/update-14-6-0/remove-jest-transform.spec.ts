import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-jest-transform';

describe('Rename jest preprocessor', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
      preset: 'react-native',
    };`
    );
    await update(tree);

    const jestConfig = tree.read('apps/products/jest.config.ts', 'utf-8');
    expect(jestConfig).not.toContain(`transform`);
  });

  it(`should remove transform if the code contains existing preprocessor`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
        preset: 'react-native',
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
    expect(jestConfig).not.toContain('transfrom: {');
    expect(jestConfig).not.toContain(`testRunner: 'jest-jasmine2',`);
  });

  it(`should rename .babelrc to babel.config.json`, async () => {
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
      preset: 'react-native',
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
});

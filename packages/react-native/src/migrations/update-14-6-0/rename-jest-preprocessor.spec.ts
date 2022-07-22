import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './rename-jest-preprocessor';

describe('Rename jest preprocessor', () => {
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

  it(`should not update if the code does not contain existing preprocessor`, async () => {
    tree.write(
      'apps/products/jest.config.js',
      `module.exports = {
      preset: 'react-native',
    };`
    );
    await update(tree);

    const jestConfig = tree.read('apps/products/jest.config.js', 'utf-8');
    expect(jestConfig).not.toContain(
      `@nrwl/react-native/plugins/jest/preprocessor.js`
    );
  });

  it(`should update if the code contains existing preprocessor`, async () => {
    tree.write(
      'apps/products/jest.config.js',
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

    const jestConfig = tree.read('apps/products/jest.config.js', 'utf-8');
    expect(jestConfig).toContain(
      `@nrwl/react-native/plugins/jest/preprocessor.js`
    );
    expect(jestConfig).not.toContain(`testRunner: 'jest-jasmine2',`);
  });
});

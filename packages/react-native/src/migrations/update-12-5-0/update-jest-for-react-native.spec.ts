import { addProjectConfiguration, formatFiles, Tree } from '@nrwl/devkit';
import update from './update-jest-for-react-native';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { format } from 'prettier';

jest.mock('@nrwl/jest/src/migrations/update-10-0-0/require-jest-config', () => {
  return {
    getJestObject: () => {
      return {
        preset: 'react-native',
      };
    },
  };
});

describe('update jest for react native 12.5.0', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    tree.write(
      '/apps/products/jest.config.js',
      `const workspacePreset = require('../../jest.preset');
module.exports = {
  ...workspacePreset,
  preset: 'react-native'
};`
    );
    tree.write('/apps/products-2/jest.config.js', `{preset: 'other'}`);
    tree.write(
      'apps/products/test-setup.ts',
      `import { jest } from '@jest/globals';
import '@testing-library/jest-native/extend-expect';
jest.useFakeTimers();`
    );

    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });

    addProjectConfiguration(tree, 'products-2', {
      root: 'apps/products-2',
      sourceRoot: 'apps/products-2/src',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products-2/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });
  });

  it('should update the jest.config files by removing ...workspacePreset for react-native apps', async () => {
    await update(tree);
    await formatFiles(tree);

    const jestConfig = tree.read('apps/products/jest.config.js', 'utf-8');
    expect(
      format(jestConfig, {
        singleQuote: true,
        parser: 'typescript',
      })
    ).toEqual(
      `module.exports = {
  resolver: '@nrwl/jest/plugins/resolver',
  preset: 'react-native',
};
`
    );
    const testSetup = tree.read('apps/products/test-setup.ts', 'utf-8');
    expect(
      format(testSetup, {
        singleQuote: true,
        parser: 'typescript',
      })
    ).toEqual(`import '@testing-library/jest-native/extend-expect';
`);
  });

  it('should not update the jest.config files ', async () => {
    await update(tree);

    const jestConfig = tree.read('apps/products-2/jest.config.js', 'utf-8');
    expect(jestConfig).toEqual(`{preset: 'other'}`);
  });
});

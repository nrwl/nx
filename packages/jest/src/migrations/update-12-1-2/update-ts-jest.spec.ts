import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import { jestConfigObject } from '../../utils/config/functions';
import update from './update-ts-jest';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestObject = {
  globals: { 'ts-jest': { tsConfig: '<rootDir>/tsconfig.spec.json' } },
};

describe('update 12.1.2', () => {
  let tree: Tree;
  const jestConfig = String.raw`
    module.exports = ${JSON.stringify(jestObject, null, 2)}
  `;

  beforeEach(() => {
    getJestObjectMock.mockImplementation((path: string): any => {
      if (path.includes('apps/products')) {
        return jestObject;
      }
    });

    tree = createTreeWithEmptyWorkspace();

    tree.write('apps/products/jest.config.js', jestConfig);
    tree.write(
      'apps/products/src/test-setup.ts',
      `import 'jest-preset-angular';`
    );
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
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

  it('should update the jest.config files by renaming tsConfig', async () => {
    await update(tree);

    const jestObject = jestConfigObject(tree, 'apps/products/jest.config.js');

    expect(jestObject.globals['ts-jest']['tsconfig']).toEqual(
      '<rootDir>/tsconfig.spec.json'
    );
    expect(jestObject.globals['ts-jest']['tsConfig']).toBeUndefined();
  });

  it('should ignore migration if the jest config does not have a globals prop', async () => {
    getJestObjectMock.mockImplementation((path: string): any => {
      if (path.includes('apps/products')) {
        // return empty jest config without globals
        return {};
      }
    });

    await expect(update(tree)).resolves.not.toThrowError();
  });

  it('should ignore migration if the jest config does not have a tsconfig prop', async () => {
    getJestObjectMock.mockImplementation((path: string): any => {
      if (path.includes('apps/products')) {
        // return empty jest config without tsconfig
        return { globals: { 'ts-jest': {} } };
      }
    });

    await expect(update(tree)).resolves.not.toThrowError();
  });
});

import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import { jestConfigObject } from '../../utils/config/functions';
import update from './add-test-environment-for-node';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestObject = {};

describe('update 12.4.0', () => {
  let tree: Tree;
  const jestConfig = String.raw`
    module.exports = ${JSON.stringify(jestObject, null, 2)}
  `;

  beforeEach(() => {
    getJestObjectMock.mockImplementation((path: string): any => {
      return jestObject;
    });

    tree = createTreeWithEmptyWorkspace();

    tree.write('apps/products/jest.config.js', jestConfig);
    tree.write('apps/products-2/jest.config.js', jestConfig);

    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        build: {
          executor: '@nrwl/node:package',
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

    addProjectConfiguration(tree, 'products-2', {
      root: 'apps/products-2',
      sourceRoot: 'apps/products-2/src',
      targets: {
        build: {
          executor: '@nrwl/angular:build',
        },
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

  it('should update the jest.config files by adding testEnvironment for node projects', async () => {
    await update(tree);

    const jestObject = jestConfigObject(tree, 'apps/products/jest.config.js');

    expect(jestObject.testEnvironment).toEqual('node');
  });

  it('should not change the testEnvironment for angular apps', async () => {
    await update(tree);

    const jestObject = jestConfigObject(tree, 'apps/products-2/jest.config.js');

    expect(jestObject.testEnvironment).toBeUndefined();
  });
});

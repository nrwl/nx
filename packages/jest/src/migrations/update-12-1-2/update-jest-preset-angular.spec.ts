import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './update-jest-preset-angular';

import { getJestObject } from '../update-10-0-0/require-jest-config';
import { jestConfigObject } from '../../utils/config/functions';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestObject = {
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js',
  ],
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

  it('should update the jest.config files', async () => {
    await update(tree);

    const jestObject = jestConfigObject(tree, 'apps/products/jest.config.js');

    expect(jestObject.snapshotSerializers).toEqual([
      'jest-preset-angular/build/serializers/no-ng-attributes',
      'jest-preset-angular/build/serializers/ng-snapshot',
      'jest-preset-angular/build/serializers/html-comment',
    ]);
  });

  it('should update the test-setup files', async () => {
    await update(tree);

    const testSetup = tree
      .read('apps/products/src/test-setup.ts')
      .toString('utf-8')
      .trim();

    expect(testSetup).toEqual(`import 'jest-preset-angular/setup-jest';`);
  });
});

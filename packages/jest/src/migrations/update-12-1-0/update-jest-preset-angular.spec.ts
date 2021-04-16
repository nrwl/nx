import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import { jestConfigObject } from '../utils/config/legacy/functions';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestObject = {
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js',
  ],
};

describe('update 12.1.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;
  const jestConfig = String.raw`
    module.exports = ${JSON.stringify(jestObject, null, 2)}
  `;

  beforeEach(() => {
    getJestObjectMock.mockImplementation((path: string): any => {
      if (path.includes('apps/products')) {
        return jestObject;
      }
    });

    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.create('apps/products/jest.config.js', jestConfig);
    initialTree.create(
      'apps/products/src/test-setup.ts',
      `import 'jest-preset-angular';`
    );
    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          products: {
            root: 'apps/products',
            sourceRoot: 'apps/products/src',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/products/jest.config.js',
                  passWithNoTests: true,
                },
              },
            },
          },
        },
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should update the jest.config files', async (done) => {
    await schematicRunner
      .runSchematicAsync('update-jest-preset-angular-8-4-0', {}, initialTree)
      .toPromise();

    const jestObject = jestConfigObject(
      initialTree,
      'apps/products/jest.config.js'
    );

    expect(jestObject.snapshotSerializers).toEqual([
      'jest-preset-angular/build/serializers/no-ng-attributes',
      'jest-preset-angular/build/serializers/ng-snapshot',
      'jest-preset-angular/build/serializers/html-comment',
    ]);

    done();
  });

  it('should update the test-setup files', async (done) => {
    await schematicRunner
      .runSchematicAsync('update-jest-preset-angular-8-4-0', {}, initialTree)
      .toPromise();

    const testSetup = initialTree
      .read('apps/products/src/test-setup.ts')
      .toString('utf-8')
      .trim();

    expect(testSetup).toEqual(`import 'jest-preset-angular/setup-jest';`);

    done();
  });
});

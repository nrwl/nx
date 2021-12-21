import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';
import { jestConfigObject } from '../utils/config/legacy/functions';
import { getJestObject } from '../update-10-0-0/require-jest-config';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestObject = {
  name: 'test-jest',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/libs/test-jest',
  globals: {
    'existing-global': 'test',
    'ts-jest': {
      astTransformers: [
        'jest-preset-angular/build/InlineFilesTransformer',
        'jest-preset-angular/build/StripStylesTransformer',
      ],
    },
  },
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js',
  ],
};

describe('update ts-jest', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;
  const jestConfig = String.raw`
    module.exports = ${JSON.stringify(jestObject, null, 2)}
  `;

  beforeEach(() => {
    getJestObjectMock.mockImplementation(() => jestObject as any);

    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.create('apps/products/jest.config.js', jestConfig);
    initialTree.create(
      'apps/products/src/test-setup.ts',
      `import 'jest-preset-angular'`
    );
    initialTree.overwrite(
      'workspace.json',
      JSON.stringify({
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
                  tsConfig: 'apps/products/tsconfig.spec.json',
                  setupFile: 'apps/products/src/test-setup.ts',
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

  it('should update the jest.config files', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-ts-jest', {}, initialTree)
      .toPromise();

    const jestObject = jestConfigObject(result, 'apps/products/jest.config.js');

    expect((jestObject.globals['ts-jest'] as any).astTransformers).toEqual({
      before: [
        'jest-preset-angular/build/InlineFilesTransformer',
        'jest-preset-angular/build/StripStylesTransformer',
      ],
    });
  });
});

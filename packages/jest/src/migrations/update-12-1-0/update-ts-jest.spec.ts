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
  globals: { 'ts-jest': { tsConfig: '<rootDir>/tsconfig.spec.json' } },
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

  it('should update the jest.config files by renaming tsConfig', async () => {
    await schematicRunner
      .runSchematicAsync('update-ts-jest-6-5-5', {}, initialTree)
      .toPromise();

    const jestObject = jestConfigObject(
      initialTree,
      'apps/products/jest.config.js'
    );

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

    await expect(
      schematicRunner
        .runSchematicAsync('update-ts-jest-6-5-5', {}, initialTree)
        .toPromise()
    ).resolves.not.toThrowError();
  });

  it('should ignore migration if the jest config does not have a tsconfig prop', async () => {
    getJestObjectMock.mockImplementation((path: string): any => {
      if (path.includes('apps/products')) {
        // return empty jest config without tsconfig
        return { globals: { 'ts-jest': {} } };
      }
    });

    await expect(
      schematicRunner
        .runSchematicAsync('update-ts-jest-6-5-5', {}, initialTree)
        .toPromise()
    ).resolves.not.toThrowError();
  });
});

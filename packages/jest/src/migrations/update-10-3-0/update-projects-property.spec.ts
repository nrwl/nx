import { tags } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('update projects property', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.create(
      'jest.config.js',
      tags.stripIndents`
      module.exports = {
        testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
        transform: {
          '^.+\\\\.(ts|js|html)$': 'ts-jest',
        },
        maxWorkers: 2,
      };
    `
    );

    initialTree.create(
      'apps/products/jest.config.js',
      tags.stripIndents`
      module.exports = {
        name: 'products',
        preset: '../../jest.config.js',
        coverageDirectory: '../../coverage/apps/products',
        snapshotSerializers: [
          'jest-preset-angular/build/AngularSnapshotSerializer.js',
          'jest-preset-angular/build/HTMLCommentSerializer.js'
        ],
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        globals: {
          'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.spec.json',
            stringifyContentPathRegex: '\\.(html|svg)$',
            astTransformers: [
              'jest-preset-angular/build/InlineFilesTransformer',
              'jest-preset-angular/build/StripStylesTransformer'
            ]
          }
        }
      };
    `
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
          cart: {
            root: 'apps/cart',
            sourceRoot: 'apps/cart/src',
            architect: {
              build: {
                builder: '@nrwl/web:build',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/cart/jest.config.js',
                  passWithNoTests: true,
                },
              },
            },
          },
          basket: {
            root: 'apps/basket',
            sourceRoot: 'apps/basket/src',
            architect: {
              build: {
                builder: '@nrwl/web:build',
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

  it('should remove setupFile and tsconfig in test architect from workspace.json', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-projects-property', {}, initialTree)
      .toPromise();

    const updatedJestConfig = result.readContent('jest.config.js');
    expect(tags.stripIndents`${updatedJestConfig}`).toEqual(tags.stripIndents`
     module.exports = {
        projects: ['<rootDir>/apps/products', '<rootDir>/apps/cart'],
      };
    `);

    const jestPreset = result.readContent('jest.preset.js');
    expect(tags.stripIndents`${jestPreset}`).toEqual(tags.stripIndents`
    const nxPreset = require('@nrwl/jest/preset');
    module.exports = {
        ...nxPreset,
        testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
        transform: {
          '^.+\\\\.(ts|js|html)$': 'ts-jest',
        },
        maxWorkers: 2,
      };
    `);

    const projectConfig = result.readContent('apps/products/jest.config.js');
    expect(tags.stripIndents`${projectConfig}`).toEqual(tags.stripIndents`
     module.exports = {
       preset: '../../jest.preset.js',
       coverageDirectory: '../../coverage/apps/products',
       snapshotSerializers: [
         'jest-preset-angular/build/AngularSnapshotSerializer.js',
         'jest-preset-angular/build/HTMLCommentSerializer.js',
        ],
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        globals: {
          'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.spec.json',
            stringifyContentPathRegex: '\\.(html|svg)$',
            astTransformers: [
              'jest-preset-angular/build/InlineFilesTransformer',
              'jest-preset-angular/build/StripStylesTransformer',
            ],
          },
        },
        displayName: 'products',
      };
    `);
  });
});

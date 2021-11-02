import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/workspace';

describe('Update 9.0.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    initialTree = createEmptyWorkspace(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );

    initialTree.overwrite(
      'package.json',
      serializeJson({ devDependencies: { 'jest-preset-angular': '7.0.0' } })
    );

    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        projects: {
          'angular-one': {
            root: 'apps/angular-one/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/angular-one/jest.config.js',
                },
              },
            },
          },
          'angular-two': {
            root: 'apps/angular-two/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/angular-two/jest.config.js',
                },
              },
            },
          },
          'non-angular-one': {
            root: 'apps/non-angular-one/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/non-angular-one/jest.config.js',
                },
              },
            },
          },
        },
      })
    );

    initialTree.create(
      'apps/angular-one/jest.config.js',
      `module.exports = {
        name: 'angular-one',
        preset: '../../jest.config.js',
        coverageDirectory:
            '../../coverage/apps/angular-one',
        snapshotSerializers: [
            'jest-preset-angular/AngularSnapshotSerializer.js',
            'jest-preset-angular/HTMLCommentSerializer.js'
        ]
      };`
    );

    initialTree.create(
      'apps/angular-two/jest.config.js',
      `module.exports = {
        name: 'angular-two',
        preset: '../../jest.config.js',
        coverageDirectory:
            '../../coverage/apps/angular-two',
        snapshotSerializers: [
            'jest-preset-angular/AngularSnapshotSerializer.js',
            'jest-preset-angular/HTMLCommentSerializer.js'
        ]
      };`
    );

    initialTree.create(
      'apps/non-angular-one/jest.config.js',
      `module.exports = {
        name: 'non-angular-one',
        preset: '../../jest.config.js',
        coverageDirectory:
            '../../coverage/apps/non-angular-one',
        moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
      };`
    );
  });

  it('should update jest-preset-angular to 8.0.0', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-9.0.0', {}, initialTree)
      .toPromise();

    const { devDependencies } = readJsonInTree(result, 'package.json');
    expect(devDependencies['jest-preset-angular']).toEqual('8.0.0');
  });

  it(`it should add '/build' into jest-preset-angular snapshotSerializers in any jest.config.js where it exists`, async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-9.0.0', {}, initialTree)
      .toPromise();

    const updateJestAngularOne = result.readContent(
      'apps/angular-one/jest.config.js'
    );
    const updateJestAngularTwo = result.readContent(
      'apps/angular-two/jest.config.js'
    );
    const updateJestNonAngularOne = result.readContent(
      'apps/non-angular-one/jest.config.js'
    );

    expect(updateJestAngularOne).not.toContain(
      'jest-preset-angular/AngularSnapshotSerializer.js'
    );
    expect(updateJestAngularOne).not.toContain(
      'jest-preset-angular/HTMLCommentSerializer.js'
    );
    expect(updateJestAngularTwo).not.toContain(
      'jest-preset-angular/AngularSnapshotSerializer.js'
    );
    expect(updateJestAngularTwo).not.toContain(
      'jest-preset-angular/HTMLCommentSerializer.js'
    );

    expect(updateJestAngularOne).toContain(
      'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js'
    );
    expect(updateJestAngularOne).toContain(
      'jest-preset-angular/build/AngularSnapshotSerializer.js'
    );
    expect(updateJestAngularOne).toContain(
      'jest-preset-angular/build/HTMLCommentSerializer.js'
    );

    expect(updateJestAngularTwo).toContain(
      'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js'
    );
    expect(updateJestAngularTwo).toContain(
      'jest-preset-angular/build/AngularSnapshotSerializer.js'
    );
    expect(updateJestAngularTwo).toContain(
      'jest-preset-angular/build/HTMLCommentSerializer.js'
    );

    expect(updateJestNonAngularOne).not.toContain(
      'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js'
    );
    expect(updateJestNonAngularOne).not.toContain(
      'jest-preset-angular/build/AngularSnapshotSerializer.js'
    );
    expect(updateJestNonAngularOne).not.toContain(
      'jest-preset-angular/build/HTMLCommentSerializer.js'
    );
  });
});

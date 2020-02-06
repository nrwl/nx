import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/workspace';
import { readFileSync } from 'fs';

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
        version: 1,
        projects: {
          'angular-one': {
            root: 'apps/angular-one/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/angular-one/jest.config.js'
                }
              }
            }
          },
          'angular-two': {
            root: 'apps/angular-two/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/angular-two/jest.config.js',
                  passWithNoTests: false
                }
              }
            }
          },
          'non-angular-one': {
            root: 'apps/non-angular-one/',
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/non-angular-one/jest.config.js'
                }
              }
            }
          },
          other1: {
            architect: {
              'other-architect': {
                builder: 'other',
                options: {
                  foo: 'bar'
                }
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {}
              }
            }
          }
        }
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

  it('should remove passWithNoTests in jest.config.js', async () => {
    initialTree.create(
      'jest.config.js',
      readFileSync(
        path.join(__dirname, './test-files/jest.config.js')
      ).toString()
    );
    const initialJestConfigFile = initialTree.read('jest.config.js').toString();
    expect(initialJestConfigFile).toContain('passWithNoTests: true');

    const result = await schematicRunner
      .runSchematicAsync('update-9.0.0', {}, initialTree)
      .toPromise();

    const updatedJestConfigFile = result.readContent('jest.config.js');
    expect(updatedJestConfigFile).not.toContain('passWithNoTests: true');
    console.log(updatedJestConfigFile);
  });

  it('should add passWithNoTests to workspace.json where it does not exist', async () => {
    await schematicRunner
      .runSchematicAsync('update-9.0.0', {}, initialTree)
      .toPromise();

    const workspaceJson = readJsonInTree(initialTree, 'workspace.json');
    expect(
      workspaceJson.projects['angular-one'].architect.test.options
        .passWithNoTests
    ).toBeTruthy();
    expect(
      workspaceJson.projects['angular-two'].architect.test.options
        .passWithNoTests
    ).toBeFalsy();
    expect(
      workspaceJson.projects.other1.architect['other-architect'].options
        .passWithNoTests
    ).toBeUndefined();
    expect(
      workspaceJson.projects.other1.architect.test.options.passWithNoTests
    ).toBeTruthy();
  });

  it('should add passWithNoTests to angular.json where it does not exist', async () => {
    initialTree.create(
      'angular.json',
      JSON.stringify({
        version: 1,
        projects: {
          frontend: {
            architect: {
              jest1: {
                builder: '@nrwl/jest:jest',
                options: {
                  foo: 'bar'
                }
              },
              jest2: {
                builder: '@nrwl/jest:jest',
                options: {
                  foo: 'bar',
                  passWithNoTests: false
                }
              },
              other1: {
                options: {
                  foo: 'bar'
                }
              }
            }
          }
        }
      })
    );

    await schematicRunner
      .runSchematicAsync('update-9.0.0', {}, initialTree)
      .toPromise();

    const angularJson = readJsonInTree(initialTree, 'angular.json');

    expect(
      angularJson.projects.frontend.architect.jest1.options.passWithNoTests
    ).toBeTruthy();
    expect(
      angularJson.projects.frontend.architect.jest2.options.passWithNoTests
    ).toBeFalsy();
    expect(
      angularJson.projects.frontend.architect.other1.options.passWithNoTests
    ).toBeUndefined();
  });
});

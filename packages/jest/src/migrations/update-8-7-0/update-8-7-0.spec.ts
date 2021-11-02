import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';

describe('Update 8.7.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should convert testPathPattern option to an array', async () => {
    tree.create(
      'angular.json',
      JSON.stringify({
        version: 1,
        projects: {
          test: {
            architect: {
              jest1: {
                builder: '@nrwl/jest:jest',
                options: {
                  testPathPattern: 'some/test/path',
                },
              },
              jest2: {
                builder: '@nrwl/jest:jest',
                options: {
                  foo: 'bar',
                },
              },
              jest3: {
                builder: '@nrwl/jest:jest',
              },
            },
          },
        },
      })
    );

    await schematicRunner
      .runSchematicAsync('update-8.7.0', {}, tree)
      .toPromise();

    const angularJson = readJsonInTree(tree, 'angular.json');

    expect(
      angularJson.projects.test.architect.jest1.options.testPathPattern
    ).toEqual(['some/test/path']);
    expect(
      angularJson.projects.test.architect.jest2.options.testPathPattern
    ).toBeUndefined();
  });
});

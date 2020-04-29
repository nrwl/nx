import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';
import { join } from 'path';

describe('Update 8.3.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());

    tree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          '@angular/cli': '8.0.0',
          '@angular-devkit/build-angular': '^0.800.0',
          '@angular-devkit/build-ng-packagr': '~0.800.0',
        },
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      join(__dirname, '../../../migrations.json')
    );
  });

  describe('Update Angular CLI', () => {
    it('should update @angular/cli', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-angular-cli-8-1', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies['@angular/cli']
      ).toEqual('8.1.1');
    });

    it('should update @angular-devkit/build-angular', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-angular-cli-8-1', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies[
          '@angular-devkit/build-angular'
        ]
      ).toEqual('^0.801.1');
    });

    it('should update @angular-devkit/build-ng-packagr', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-angular-cli-8-1', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies[
          '@angular-devkit/build-ng-packagr'
        ]
      ).toEqual('~0.801.1');
    });
  });
});

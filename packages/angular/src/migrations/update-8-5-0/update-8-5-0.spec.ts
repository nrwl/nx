import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';
import { join } from 'path';

describe('Update 8.5.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      join(__dirname, '../../../migrations.json')
    );
  });

  describe('Update Angular CLI', () => {
    it('should update @angular/cli', async () => {
      tree.create(
        'package.json',
        serializeJson({
          devDependencies: {
            '@angular/cli': '8.0.0'
          }
        })
      );

      const result = await schematicRunner
        .runSchematicAsync('upgrade-cli-8-3', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies['@angular/cli']
      ).toEqual('8.3.3');
    });

    it('should coerce a version with a caret into a valid version', async () => {
      tree.create(
        'package.json',
        serializeJson({
          devDependencies: {
            '@angular/cli': '^8.0.0'
          }
        })
      );

      const result = await schematicRunner
        .runSchematicAsync('upgrade-cli-8-3', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies['@angular/cli']
      ).toEqual('8.3.3');
    });

    it('should coerce a version with a tilde into a valid version', async () => {
      tree.create(
        'package.json',
        serializeJson({
          devDependencies: {
            '@angular/cli': '~8.0.0'
          }
        })
      );

      const result = await schematicRunner
        .runSchematicAsync('upgrade-cli-8-3', {}, tree)
        .toPromise();

      expect(
        readJsonInTree(result, 'package.json').devDependencies['@angular/cli']
      ).toEqual('8.3.3');
    });

    it('should fail if the version cannot be validated', async () => {
      let error = null;

      tree.create(
        'package.json',
        serializeJson({
          devDependencies: {
            '@angular/cli': '>=8.0.0'
          }
        })
      );

      try {
        await schematicRunner
          .runSchematicAsync('upgrade-cli-8-3', {}, tree)
          .toPromise();
      } catch (e) {
        error = e;
      }

      expect(error).toStrictEqual(
        new Error(
          `The package.json lists a version of @angular/cli that Nx is unable to validate - (>=8.0.0)`
        )
      );
    });
  });
});

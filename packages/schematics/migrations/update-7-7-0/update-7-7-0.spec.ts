import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';

import { join } from 'path';
import { readJsonInTree } from '@nrwl/workspace';
import { serializeJson } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update 7.7.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      join(__dirname, '../migrations.json')
    );
  });

  describe('setting defaults to angular', () => {
    it('should set default lib framework to Angular', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-7.7.0', {}, initialTree)
        .toPromise();

      expect(
        readJsonInTree(result, 'workspace.json').schematics[
          '@nrwl/schematics:library'
        ].framework
      ).toEqual('angular');
    });
  });

  describe('jest update', () => {
    beforeEach(() => {
      initialTree.overwrite(
        'package.json',
        serializeJson({
          devDependencies: {
            jest: '23.10.5',
            'jest-preset-angular': '6.0.2'
          }
        })
      );
      initialTree.create(
        'jest.config.js',
        `module.exports = {
          testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
          transform: {
            '^.+\\.(ts|js|html)$': 'jest-preset-angular/preprocessor.js'
          },
          resolver: '@nrwl/builders/plugins/jest/resolver',
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageReporters: ['html']
        };`
      );
    });

    it('should update jest dependencies', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-7.7.0', {}, initialTree)
        .toPromise();

      const { devDependencies } = readJsonInTree(result, 'package.json');
      expect(devDependencies.jest).toEqual('24.1.0');
      expect(devDependencies['jest-preset-angular']).toEqual('7.0.0');
    });

    it('should update jest.config.js', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-7.7.0', {}, initialTree)
        .toPromise();

      expect(result.readContent('jest.config.js')).not.toContain(
        'jest-preset-angular/preprocessor.js'
      );
    });
  });
});

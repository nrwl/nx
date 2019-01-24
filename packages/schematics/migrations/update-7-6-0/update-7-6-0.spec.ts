import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

import * as path from 'path';

import { serializeJson } from '../../src/utils/fileutils';
import { readJsonInTree, updateJsonInTree } from '../../src/utils/ast-utils';

describe('Update 7.6.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();

    initialTree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          '@angular/cli': '7.1.0',
          typescript: '~3.1.0'
        }
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should add vscode extension recommendations', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.6.0', {}, initialTree)
      .toPromise();

    expect(readJsonInTree(result, '.vscode/extensions.json')).toEqual({
      recommendations: [
        'nrwl.angular-console',
        'angular.ng-template',
        'esbenp.prettier-vscode'
      ]
    });
  });

  it('should add to existing vscode extension recommendations', async () => {
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('.vscode/extensions.json', () => ({
          recommendations: ['eamodio.gitlens', 'angular.ng-template']
        })),
        initialTree
      )
      .toPromise();

    const result = await schematicRunner
      .runSchematicAsync('update-7.6.0', {}, initialTree)
      .toPromise();

    expect(readJsonInTree(result, '.vscode/extensions.json')).toEqual({
      recommendations: [
        'eamodio.gitlens',
        'angular.ng-template',
        'nrwl.angular-console',
        'esbenp.prettier-vscode'
      ]
    });
  });
});

import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/schematics/testing';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { readJsonInTree } from '@nrwl/schematics';

describe('ng-add', () => {
  let tree: Tree;
  let testRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = new VirtualTree();
    tree = createEmptyWorkspace(tree);
    testRunner = new SchematicTestRunner(
      '@nrwl/express',
      join(__dirname, '../../../collection.json')
    );
  });

  it('should add dependencies', async () => {
    const result = await testRunner
      .runSchematicAsync('ng-add', {}, tree)
      .toPromise();
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.dependencies['@nrwl/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/express']).toBeDefined();
    expect(packageJson.dependencies['express']).toBeDefined();
    expect(packageJson.devDependencies['@types/express']).toBeDefined();
  });
});

import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateImports } from './update-imports';

describe('updateImports Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'my-source',
      destination: 'my-destination'
    };
  });

  it('should update project refs', async () => {
    // this is a bit of a cheat - we expect to run this rule on an intermediate state
    // tree where the workspace hasn't been updated yet, so just create libs representing
    // source and destination to make sure that the workspace has libraries with those names.
    tree = await runSchematic('lib', { name: 'my-destination' }, tree);
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    tree = await runSchematic('lib', { name: 'my-importer' }, tree);
    const importerFilePath = 'libs/my-importer/src/importer.ts';
    tree.create(
      importerFilePath,
      `
      import { MyClass } from '@proj/my-source';

      export MyExtendedClass extends MyClass {};
    `
    );

    tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { MyClass } from '@proj/my-destination';`
    );
  });

  it('should update project ref in the tsconfig file', async () => {
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    let tsConfig = readJsonInTree(tree, '/tsconfig.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-source': ['libs/my-source/src/index.ts']
    });

    tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;

    tsConfig = readJsonInTree(tree, '/tsconfig.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['libs/my-destination/src/index.ts']
    });
  });
});

import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { checkImports } from './check-imports';

describe('updateImports Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'my-source'
    };

    tree = await runSchematic('lib', { name: 'my-dependent' }, tree);
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    // don't need to actually create the source class as we don't check for that
    const dependentFilePath = 'libs/my-dependent/src/dependent.ts';
    tree.create(
      dependentFilePath,
      `
      import { MyClass } from '@proj/my-source';

      export MyExtendedClass extends MyClass {};
    `
    );
  });

  it('should fatally error if any apparent dependent exists', async () => {
    await expect(callRule(checkImports(schema), tree)).rejects.toThrow();
  });

  it('should not error if forceRemove is true', async () => {
    schema.forceRemove = true;

    await expect(callRule(checkImports(schema), tree)).resolves.not.toThrow();
  });
});

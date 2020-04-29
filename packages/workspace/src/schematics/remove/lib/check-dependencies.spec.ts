import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { checkDependencies } from './check-dependencies';

describe('updateImports Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'my-source',
      skipFormat: false,
      forceRemove: false,
    };

    tree = await runSchematic('lib', { name: 'my-dependent' }, tree);
    tree = await runSchematic('lib', { name: 'my-source' }, tree);
  });

  describe('static dependencies', () => {
    beforeEach(() => {
      const sourceFilePath = 'libs/my-source/src/lib/my-source.ts';
      tree.overwrite(
        sourceFilePath,
        `export class MyClass {}
        `
      );

      const dependentFilePath = 'libs/my-dependent/src/lib/my-dependent.ts';
      tree.overwrite(
        dependentFilePath,
        `import { MyClass } from '@proj/my-source';
  
        export MyExtendedClass extends MyClass {};
      `
      );
    });

    it('should fatally error if any dependent exists', async () => {
      await expect(callRule(checkDependencies(schema), tree)).rejects.toThrow(
        `${schema.projectName} is still depended on by the following projects:\nmy-dependent`
      );
    });

    it('should not error if forceRemove is true', async () => {
      schema.forceRemove = true;

      await expect(
        callRule(checkDependencies(schema), tree)
      ).resolves.not.toThrow();
    });
  });

  describe('implicit dependencies', () => {
    beforeEach(async () => {
      tree = (await callRule(
        updateJsonInTree('nx.json', (json) => {
          json.projects['my-dependent'].implicitDependencies = ['my-source'];
          return json;
        }),
        tree
      )) as UnitTestTree;
    });

    it('should fatally error if any dependent exists', async () => {
      await expect(callRule(checkDependencies(schema), tree)).rejects.toThrow(
        `${schema.projectName} is still depended on by the following projects:\nmy-dependent`
      );
    });

    it('should not error if forceRemove is true', async () => {
      schema.forceRemove = true;

      await expect(
        callRule(checkDependencies(schema), tree)
      ).resolves.not.toThrow();
    });
  });

  it('should not error if there are no dependents', async () => {
    await expect(
      callRule(checkDependencies(schema), tree)
    ).resolves.not.toThrow();
  });
});

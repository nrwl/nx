import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import {
  callRule,
  createEmptyWorkspace,
  runSchematic,
} from '@nrwl/workspace/testing';
import { Schema } from '@nrwl/workspace/src/schematics/move/schema';
import { Linter, readJsonInTree } from '@nrwl/workspace';
import { updateEslintrcJson } from '@nrwl/workspace/src/schematics/move/lib/update-eslintrc-json';

describe('updateEslint Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should handle .eslintrc.json not existing', async () => {
    tree = await runSchematic(
      'lib',
      { name: 'my-lib', linter: Linter.TsLint },
      tree
    );

    expect(tree.files).not.toContain('/libs/my-destination/.estlintrc.json');

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    await expect(
      callRule(updateEslintrcJson(schema), tree)
    ).resolves.not.toThrow();
  });

  it('should update .eslintrc.json extends path when project is moved to subdirectory', async () => {
    const eslintRc = {
      extends: '../../.eslintrc.json',
      rules: {},
      ignorePatterns: ['!**/*'],
    };

    tree = await runSchematic(
      'lib',
      { name: 'my-lib', linter: Linter.EsLint },
      tree
    );

    tree.create('/libs/core/my-lib/.eslintrc.json', JSON.stringify(eslintRc));

    expect(tree.files).toContain('/libs/core/my-lib/.eslintrc.json');

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'core/my-lib',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = (await callRule(updateEslintrcJson(schema), tree)) as UnitTestTree;

    expect(readJsonInTree(tree, '/libs/core/my-lib/.eslintrc.json')).toEqual(
      jasmine.objectContaining({
        extends: '../../../.eslintrc.json',
      })
    );
  });

  it('should update .eslintrc.json extends path when is renamed', async () => {
    const eslintRc = {
      extends: '../../.eslintrc.json',
      rules: {},
      ignorePatterns: ['!**/*'],
    };

    tree = await runSchematic(
      'lib',
      { name: 'my-lib', linter: Linter.EsLint },
      tree
    );

    tree.create(
      '/libs/my-destination/.eslintrc.json',
      JSON.stringify(eslintRc)
    );

    expect(tree.files).toContain('/libs/my-destination/.eslintrc.json');

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = (await callRule(updateEslintrcJson(schema), tree)) as UnitTestTree;

    expect(readJsonInTree(tree, '/libs/my-destination/.eslintrc.json')).toEqual(
      jasmine.objectContaining({
        extends: '../../.eslintrc.json',
      })
    );
  });
});

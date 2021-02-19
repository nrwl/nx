import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Linter } from '../../../utils/lint';

import { Schema } from '../schema';
import { updateEslintrcJson } from './update-eslintrc-json';
import { libraryGenerator } from '../../library/library';

describe('updateEslint', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle .eslintrc.json not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.TsLint,
    });

    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    expect(() => {
      updateEslintrcJson(tree, schema, projectConfig);
    }).not.toThrow();
  });

  it('should update .eslintrc.json extends path when project is moved to subdirectory', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.EsLint,
    });

    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/.eslintrc.json',
      'libs/shared/my-destination/.eslintrc.json'
    );

    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateEslintrcJson(tree, schema, projectConfig);

    expect(
      readJson(tree, '/libs/shared/my-destination/.eslintrc.json')
    ).toEqual(
      jasmine.objectContaining({
        extends: '../../../.eslintrc.json',
      })
    );
  });
});

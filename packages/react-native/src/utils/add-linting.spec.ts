import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/js';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      name: 'my-lib',
      directory: 'libs/my-lib',
      linter: Linter.None,
    });
  });

  it('should add a .eslintrc.json when is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.EsLint,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });

    expect(tree.exists('libs/my-lib/.eslintrc.json')).toBeTruthy();
  });

  it('should not add lint target when "none" is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.None,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeUndefined();
  });
});

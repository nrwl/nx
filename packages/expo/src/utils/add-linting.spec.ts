import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from '@nx/js';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(async () => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      directory: 'my-lib',
      linter: 'none',
    });
  });

  afterEach(() => {
    if (envBackup === undefined) delete process.env.ESLINT_USE_FLAT_CONFIG;
    else process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
  });

  it('should add update configuration when eslint is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: 'eslint',
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
      addPlugin: true,
    });

    expect(tree.exists('my-lib/eslint.config.mjs')).toBeTruthy();
  });

  it('should not add lint target when "none" is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: 'none',
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
      addPlugin: true,
    });

    expect(tree.exists('my-lib/eslint.config.mjs')).toBeFalsy();
  });
});

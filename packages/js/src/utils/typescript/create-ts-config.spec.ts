import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { extractTsConfigBase } from './create-ts-config';

describe('extractTsConfigBase', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add default rootDir if it was not set', () => {
    tree.delete('tsconfig.base.json');
    tree.write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {},
      })
    );

    extractTsConfigBase(tree);

    expect(readJson(tree, 'tsconfig.base.json')).toEqual({
      compileOnSave: false,
      compilerOptions: {
        baseUrl: '.',
      },
    });
  });
});

import { findEslintFile } from './eslint-file';

import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

describe('@nrwl/linter:eslint-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyV1Workspace();
  });

  describe('findEslintFile', () => {
    it('should return null when calling findEslintFile when no eslint is found', () => {
      expect(findEslintFile(tree)).toBe(null);
    });

    it('should return the name of the eslint config when calling findEslintFile', () => {
      tree.write('.eslintrc.json', '{}');
      expect(findEslintFile(tree)).toBe('.eslintrc.json');
    });

    it('should return the name of the eslint config when calling findEslintFile', () => {
      tree.write('.eslintrc.js', '{}');
      expect(findEslintFile(tree)).toBe('.eslintrc.js');
    });

    it('should return default name when calling findEslintFile when no eslint is found', () => {
      tree.write('.eslintrc.yaml', '{}');

      expect(findEslintFile(tree)).toBe(null);
    });
  });
});

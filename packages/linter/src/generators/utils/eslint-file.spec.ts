import { containsEslint, findEslintFile } from './eslint-file';

import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('@nrwl/linter:eslint-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('containsEslint', () => {
    it('should return false when calling containsEslint without a eslint config', () => {
      expect(containsEslint(tree)).toBe(false);
    });

    it('should return true when calling containsEslint with a .eslintrc.json config', () => {
      tree.write('.eslintrc.json', '{}');
      expect(containsEslint(tree)).toBe(true);
    });

    it('should return true when calling containsEslint with a .eslintrc.js config', () => {
      tree.write('.eslintrc.js', '{}');
      expect(containsEslint(tree)).toBe(true);
    });

    it('should return false when calling containsEslint witn an incorrect eslint file name', () => {
      tree.write('.eslintrc.yaml', '{}');
      expect(containsEslint(tree)).toBe(false);
    });
  });

  describe('findEslintFile', () => {
    it('should return default name when calling findEslintFile when no eslint is found', () => {
      expect(findEslintFile(tree)).toBe('eslintrc.json');
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

      expect(findEslintFile(tree)).toBe('eslintrc.json');
    });
  });
});

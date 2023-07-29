import {
  baseEsLintConfigFile,
  eslintConfigFileWhitelist,
  findEslintFile,
} from './eslint-file';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('@nx/linter:eslint-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('findEslintFile', () => {
    it('should return null when calling findEslintFile when no eslint is found', () => {
      expect(findEslintFile(tree)).toBe(null);
    });

    test.each(eslintConfigFileWhitelist)(
      'should return %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(eslintFileName);
      }
    );

    test.each(eslintConfigFileWhitelist)(
      'should return base file instead %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(baseEsLintConfigFile, '{}');
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(baseEsLintConfigFile);
      }
    );
  });
});

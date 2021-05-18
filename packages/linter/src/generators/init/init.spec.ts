import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Linter } from '../utils/linter';
import { lintInitGenerator } from './init';

describe('@nrwl/linter:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should generate the global eslint config', async () => {
        await lintInitGenerator(tree, {
          linter: Linter.EsLint,
        });

        expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('tslint', () => {
      it('should generate the global tslint config', async () => {
        await lintInitGenerator(tree, {
          linter: Linter.TsLint,
        });

        expect(tree.read('tslint.json', 'utf-8')).toMatchSnapshot();
      });
    });
  });
});

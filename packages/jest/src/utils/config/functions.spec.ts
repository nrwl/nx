import { createTree } from '@nx/devkit/testing';
import { jestConfigObject, jestConfigObjectAst } from './functions';

describe('jestConfigObject', () => {
  describe('module.exports', () => {
    it('should work for basic cases', () => {
      const tree = createTree();
      tree.write(
        'jest.config.js',
        `
      module.exports = {
        foo: 'bar'
      };
    `
      );

      expect(jestConfigObject(tree, 'jest.config.js')).toEqual({
        foo: 'bar',
      });
    });
  });

  describe('export default', () => {
    it('should work for basic cases', () => {
      const content = `
        export default {
          abc: 'xyz'
        }`;

      expect(jestConfigObjectAst(content).getText()).toMatchSnapshot();
    });

    it('should handle spread assignments', () => {
      const content = `
       import { nxPreset } from '@nx/jest/preset';
      
        export default {
          ...nxPreset,
          abc: 'xyz'
        }`;

      expect(jestConfigObjectAst(content).getText()).toMatchSnapshot();
    });
  });
});

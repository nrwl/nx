import {createTree} from '@nrwl/devkit/testing';
import {jestConfigObject, jestConfigObjectAst} from './functions';

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

    xit('should work with async functions', async () => {
      const tree = createTree();
      jest.mock('@nrwl/jest', () => ({
        getJestProjects: () => ['<rootDir>/project-a', '<rootDir>/project-b'],
      }));
      tree.write(
        'jest.config.js',
        `
      const { getJestProjects } = require('@nrwl/jest');
      module.exports = async () => ({
        foo: 'bar'
      });
    `
      );

      expect(await jestConfigObject(tree, 'jest.config.js')).toEqual({
        foo: 'bar',
      });
    });

    it('should work with `getJestConfig`', () => {
      const tree = createTree();
      jest.mock('@nrwl/jest', () => ({
        getJestProjects: () => ['<rootDir>/project-a', '<rootDir>/project-b'],
      }));
      tree.write(
        'jest.config.js',
        `
      const { getJestProjects } = require('@nrwl/jest');
      module.exports = {
        projects: getJestProjects()
      };
    `
      );

      expect(jestConfigObject(tree, 'jest.config.js')).toEqual({
        projects: ['<rootDir>/project-a', '<rootDir>/project-b'],
      });
    });

    it('should work with node globals (require, __dirname, process, __filename, console, and other globals)', () => {
      const tree = createTree();
      jest.mock('@nrwl/jest', () => ({
        getJestProjects: () => ['<rootDir>/project-a', '<rootDir>/project-b'],
      }));
      tree.write(
        'jest.config.js',
        `
      const { getJestProjects } = require('@nrwl/jest');
      module.exports = {
        projects: getJestProjects(),
        filename: __filename,
        env: process.env,
        dirname: __dirname
      };
    `
      );

      expect(jestConfigObject(tree, 'jest.config.js')).toEqual({
        dirname: '/virtual',
        filename: '/virtual/jest.config.js',
        env: process.env,
        projects: ['<rootDir>/project-a', '<rootDir>/project-b'],
      });
    });
  })

  describe('export default', () => {
    it('should work for basic cases', () => {
      const content = `
        export default {
          abc: 'xyz'
        }`

      expect(jestConfigObjectAst(content).getText()).toMatchSnapshot();
    })

    it('should handle spread assignments', () => {
      const content = `
       import { nxPreset } from '@nrwl/jest/preset';
      
        export default {
          ...nxPreset,
          abc: 'xyz'
        }`

      expect(jestConfigObjectAst(content).getText()).toMatchSnapshot();
    })
  });
});

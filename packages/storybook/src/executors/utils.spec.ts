import * as ts from 'typescript';
import { stripIndents } from '@nrwl/devkit';
import { builderIsWebpackButNotWebpack5 } from './utils';

describe('testing utilities', () => {
  describe('builderIsWebpackButNotWebpack5', () => {
    it('should return false if builder is webpack5', () => {
      const sourceCode = stripIndents`
      module.exports = {
      core: {  builder: 'webpack5' },
    };    
    `;

      const source = ts.createSourceFile(
        '.storybook/main.js',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      expect(builderIsWebpackButNotWebpack5(source)).toBeFalsy();
    });

    it('should return false if builder is @storybook/webpack5', () => {
      const sourceCode = stripIndents`
       module.exports = {
         core: { builder: '@storybook/webpack5' },
       };    
    `;

      const source = ts.createSourceFile(
        '.storybook/main.js',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      expect(builderIsWebpackButNotWebpack5(source)).toBeFalsy();
    });

    it('should return false if builder exists but does not contain webpack', () => {
      const sourceCode = stripIndents`
      module.exports = {
      core: { builder: '@storybook/vite-builder' },
    };    
    `;

      const source = ts.createSourceFile(
        '.storybook/main.js',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      expect(builderIsWebpackButNotWebpack5(source)).toBeFalsy();
    });

    it('should return true if builder is webpack4', () => {
      const sourceCode = stripIndents`
      module.exports = {
      core: { builder: 'webpack4' },
    };    
    `;

      const source = ts.createSourceFile(
        '.storybook/main.js',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      expect(builderIsWebpackButNotWebpack5(source)).toBeTruthy();
    });

    it('should return true if builder does not exist because default is webpack', () => {
      const sourceCode = stripIndents`
      module.exports = {
      };    
    `;

      const source = ts.createSourceFile(
        '.storybook/main.js',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      expect(builderIsWebpackButNotWebpack5(source)).toBeFalsy();
    });
  });
});

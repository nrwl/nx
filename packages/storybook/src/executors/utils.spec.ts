import * as ts from 'typescript';
import { stripIndents } from '@nrwl/devkit';
import { findBuilderInMainJsTs } from './utils';
import { logger } from '@nrwl/devkit';

describe('testing utilities', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn');
  });

  it('should not log the webpack5 warning if builder is webpack5', () => {
    const sourceCode = stripIndents`
    const rootMain = require('../../../.storybook/main');

    module.exports = {
      ...rootMain,
      core: { ...rootMain.core, builder: 'webpack5' },
    };    
    `;

    const source = ts.createSourceFile(
      '.storybook/main.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    findBuilderInMainJsTs(source);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should not log the webpack5 warning if builder is @storybook/webpack5', () => {
    const sourceCode = stripIndents`
    const rootMain = require('../../../.storybook/main');

    module.exports = {
      ...rootMain,
      core: { ...rootMain.core, builder: '@storybook/webpack5' },
    };    
    `;

    const source = ts.createSourceFile(
      '.storybook/main.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    findBuilderInMainJsTs(source);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should not log the webpack5 warning if builder exists but does not contain webpack', () => {
    const sourceCode = stripIndents`
    const rootMain = require('../../../.storybook/main');

    module.exports = {
      ...rootMain,
      core: { ...rootMain.core, builder: '@storybook/vite-builder' },
    };    
    `;

    const source = ts.createSourceFile(
      '.storybook/main.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    findBuilderInMainJsTs(source);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should log the webpack5 warning if builder is webpack4', () => {
    const sourceCode = stripIndents`
    const rootMain = require('../../../.storybook/main');

    module.exports = {
      ...rootMain,
      core: { ...rootMain.core, builder: 'webpack4' },
    };    
    `;

    const source = ts.createSourceFile(
      '.storybook/main.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    findBuilderInMainJsTs(source);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should log the webpack5 warning if builder does not exist', () => {
    const sourceCode = stripIndents`
    const rootMain = require('../../../.storybook/main');

    module.exports = {
      ...rootMain,
    };    
    `;

    const source = ts.createSourceFile(
      '.storybook/main.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    findBuilderInMainJsTs(source);
    expect(logger.warn).toHaveBeenCalled();
  });
});

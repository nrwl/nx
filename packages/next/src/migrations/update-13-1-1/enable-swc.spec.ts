import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from '../../generators/application/application';
import { update } from './enable-swc';

describe('Migration: enable SWC', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove .babelrc file and fix jest config', async () => {
    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
      swc: false,
    });

    // Config that isn't configured properly
    tree.write(
      'apps/demo/jest.config.js',
      `
module.exports = {
  displayName: 'napp4',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/demo',
};

`
    );

    await update(tree);

    const result = tree.read('apps/demo/jest.config.js').toString();

    expect(result).toMatch(`['babel-jest', { presets: ['@nrwl/next/babel'] }]`);

    expect(tree.exists('apps/demo/.babelrc')).toBe(false);
  });

  it('should skip migration if SWC already enabled', async () => {
    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
      swc: true,
    });

    // Config that isn't configured properly
    tree.write(
      'apps/demo/jest.config.js',
      `
module.exports = {
  displayName: 'napp4',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/demo',
};

`
    );

    await update(tree);

    const result = tree.read('apps/demo/jest.config.js').toString();

    expect(result).not.toMatch(
      `['babel-jest', { presets: ['@nrwl/next/babel'] }]`
    );
  });
});

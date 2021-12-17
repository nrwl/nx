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

  it('should still fix jest config when babelrc is missing', async () => {
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

    expect(result).toMatch(`['babel-jest', { presets: ['@nrwl/next/babel'] }]`);
  });
  it('should skip migration if the babelrc has been customized', async () => {
    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
      swc: false,
    });

    tree.write(
      'apps/demo/.babelrc',
      `{
        "presets": ["@nrwl/next/babel", "something-else"],
        "plugins": []
      }`
    );

    await update(tree);

    expect(tree.exists('apps/demo/.babelrc')).toBe(true);

    tree.write(
      'apps/demo/.babelrc',
      `{
        "presets": ["@nrwl/next/babel"],
        "plugins": ["some-plugin"]
      }`
    );

    await update(tree);

    expect(tree.exists('apps/demo/.babelrc')).toBe(true);

    // No custom plugins, can migrate.
    tree.write(
      'apps/demo/.babelrc',
      `{
        "presets": ["@nrwl/next/babel"]
      }`
    );

    await update(tree);

    expect(tree.exists('apps/demo/.babelrc')).toBe(false);
  });

  it('should skip migration if storybook configuration is detected', async () => {
    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
      swc: false,
    });

    tree.write(
      'apps/demo/.babelrc',
      `{
        "presets": ["@nrwl/next/babel"]
      }`
    );
    tree.write(
      'apps/demo/.storybook/main.js',
      `module.exports = {
        stories: []
      }`
    );

    await update(tree);

    expect(tree.exists('apps/demo/.babelrc')).toBe(true);
  });
});

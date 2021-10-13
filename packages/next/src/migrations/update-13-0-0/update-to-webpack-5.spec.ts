import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from '../../generators/application/application';
import { update } from './update-to-webpack-5';

describe('Migration: enable webpack 5', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set webpack5 to true', async () => {
    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
    });

    // Config that isn't configured properly
    tree.write(
      'apps/demo/next.config.js',
      `const withNx = require('@nrwl/next/plugins/with-nx');
const nextConfig = {
  webpack5: false,
};

module.exports = withNx(nextConfig);
`
    );

    await update(tree);

    const result = tree.read('apps/demo/next.config.js').toString();

    expect(result).toMatch(/webpack5: true/);
  });

  it('should fix stylus support', async () => {
    await applicationGenerator(tree, {
      style: 'styl',
      name: 'demo',
      skipFormat: false,
    });

    // Config that isn't configured properly
    tree.write(
      'apps/demo/next.config.js',
      `const withNx = require('@nrwl/next/plugins/with-nx');
const withStylus = require('@zeit/next-stylus');

const nextConfig = {
  webpack5: false,
};

module.exports = withNx(withStylus(nextConfig));
`
    );

    await update(tree);

    const result = tree.read('apps/demo/next.config.js').toString();

    expect(result).toMatch(/@nrwl\/next\/plugins\/with-stylus/);
    expect(result).not.toMatch(/@zeit\/next-stylus/);
  });

  it('should fix less support', async () => {
    await applicationGenerator(tree, {
      style: 'less',
      name: 'demo',
      skipFormat: false,
    });

    // Config that isn't configured properly
    tree.write(
      'apps/demo/next.config.js',
      `const withNx = require('@nrwl/next/plugins/with-nx');
const withLess = require('@zeit/next-less');

const nextConfig = {
  webpack5: false,
};

module.exports = withNx(withLess(nextConfig));
`
    );

    await update(tree);

    const result = tree.read('apps/demo/next.config.js').toString();

    expect(result).toMatch(/next-with-less/);
    expect(result).not.toMatch(/@zeit\/next-less/);
  });
});

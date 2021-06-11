import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { updateRootBabelConfig } from './update-root-babel-config';

describe('Update root babel config', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    tree.write(
      'babel.config.json',
      JSON.stringify({
        presets: ['@nrwl/web/babel'],
      })
    );

    await updateRootBabelConfig(tree);

    expect(readJson(tree, 'babel.config.json').presets).not.toContain(
      '@nrwl/web/babel'
    );
  });
});

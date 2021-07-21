import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, writeJson, Tree } from '@nrwl/devkit';
import { updateRootBabelConfig } from './update-root-babel-config';

describe('Update root babel config', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    writeJson(tree, 'babel.config.json', {
      presets: ['@nrwl/web/babel'],
    });

    await updateRootBabelConfig(tree);

    expect(readJson(tree, 'babel.config.json').presets).not.toContain(
      '@nrwl/web/babel'
    );
  });
});

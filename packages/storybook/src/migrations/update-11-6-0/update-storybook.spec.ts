import { Tree, readJson, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';

import updateStorybook from './update-storybook';

describe('Update 11-6-0/12-3-0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTree();
  });

  it('should update storybook versions if storybook is already above 6 but below 6.2.9', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@storybook/angular': '^6.0.0',
        '@storybook/react': '^6.0.0',
        '@storybook/addon-knobs': '^6.0.0',
      },
    });
    await updateStorybook(tree);
    expect(
      readJson(tree, 'package.json').devDependencies['@storybook/angular']
    ).toBe('~6.2.9');
  });

  it('should not update storybook versions if storybook is already above 6.2.9', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@storybook/angular': '~6.2.9',
        '@storybook/react': '~6.2.9',
        '@storybook/addon-knobs': '~6.2.9',
      },
    });
    await updateStorybook(tree);
    expect(
      readJson(tree, 'package.json').devDependencies['@storybook/angular']
    ).toBe('~6.2.9');
  });

  it('should not update storybook versions if storybook is below 6', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@storybook/angular': '^5.0.0',
        '@storybook/react': '^5.0.0',
        '@storybook/addon-knobs': '^5.0.0',
      },
    });
    await updateStorybook(tree);
    expect(
      readJson(tree, 'package.json').devDependencies['@storybook/angular']
    ).toBe('^5.0.0');
  });
});

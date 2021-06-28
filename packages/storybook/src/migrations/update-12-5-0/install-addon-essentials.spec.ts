import { Tree, readJson, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';

import installAddonEssentials from './install-addon-essentials';

describe('Add the @storybook/addon-essentials package to package.json', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTree();
  });

  it('should update package.json to include the new package', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {},
    });
    await installAddonEssentials(tree);
    expect(
      readJson(tree, 'package.json').devDependencies[
        '@storybook/addon-essentials'
      ]
    ).toBeTruthy();
  });

  it('should not update package.json if package already exists', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        '@storybook/addon-essentials': '6.3.0',
      },
    });
    await installAddonEssentials(tree);
    expect(
      readJson(tree, 'package.json').devDependencies[
        '@storybook/addon-essentials'
      ]
    ).toBeFalsy();
  });
});

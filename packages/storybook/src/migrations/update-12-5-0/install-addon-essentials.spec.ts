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

  describe('Add the @storybook/addon-essentials addon in the addons array in root main.js', () => {
    beforeEach(() => {
      writeJson(tree, 'package.json', {
        devDependencies: {},
      });
    });
    it('should add the addon if other addons exist in the addons array', async () => {
      tree.write(
        '.storybook/main.js',
        `
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-something'],
        };
        `
      );

      await installAddonEssentials(tree);
      expect(tree.read('.storybook/main.js', 'utf-8')).toBe(`
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials', '@storybook/addon-something'],
        };
        `);
    });

    it('should add the addon if addons array is empty', async () => {
      tree.write(
        '.storybook/main.js',
        `
        module.exports = {
          stories: [],
          addons: [],
        };
        `
      );

      await installAddonEssentials(tree);
      expect(tree.read('.storybook/main.js', 'utf-8')).toBe(`
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials', ],
        };
        `);
    });

    it('should add the addon if addons array does not exist', async () => {
      tree.write(
        '.storybook/main.js',
        `
        module.exports = {
          stories: [],
        };
        `
      );

      await installAddonEssentials(tree);
      expect(tree.read('.storybook/main.js', 'utf-8')).toBe(`
        module.exports = {
          addons: ['@storybook/addon-essentials'], stories: [],
        };
        `);
    });

    it('should not edit the file if @storybook/addon-essentials already exists', async () => {
      tree.write(
        '.storybook/main.js',
        `
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials'],
        };
        `
      );

      await installAddonEssentials(tree);
      expect(tree.read('.storybook/main.js', 'utf-8')).toBe(`
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials'],
        };
        `);
    });
  });
});

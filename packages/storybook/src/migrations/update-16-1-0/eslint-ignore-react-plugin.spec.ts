import {
  addProjectConfiguration,
  ProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as variousProjects from '../update-15-7-0/test-configs/various-configs.json';
import eslintIgnoreReactPlugin from './eslint-ignore-react-plugin';

describe('Ignore @nx/react/plugins/storybook in Storybook eslint plugin', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(
      tree,
      variousProjects['main-vite'].name,
      variousProjects['main-vite'] as ProjectConfiguration
    );
    tree.write('apps/main-vite/tsconfig.json', `{}`);
    tree.write(
      `apps/main-vite/.storybook/main.js`,
      `
      module.exports = {
        stories: ['../src/lib/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-essentials'],
        framework: {
          name: '@storybook/react-vite',
          options: {},
        },
      };
      `
    );
    addProjectConfiguration(
      tree,
      variousProjects['main-webpack'].name,
      variousProjects['main-webpack'] as ProjectConfiguration
    );

    if (!tree.exists('.eslintrc.json')) {
      tree.write('.eslintrc.json', `{}`);
    }
  });

  it('should not ignore the plugin if it is not used', async () => {
    await eslintIgnoreReactPlugin(tree);
    const eslintConfig = readJson(tree, '.eslintrc.json');
    expect(eslintConfig).toEqual({});
    expect(eslintConfig.rules).toBeUndefined();
  });

  it('should not ignore the plugin if "plugin:storybook/recommended" is not included', async () => {
    tree.write('apps/main-webpack/tsconfig.json', `{}`);
    tree.write(
      `apps/main-webpack/.storybook/main.js`,
      `
      module.exports = {
        stories: ['../src/lib/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
        framework: {
          name: '@storybook/react-webpack5',
          options: {},
        },
      };
      `
    );

    await eslintIgnoreReactPlugin(tree);

    const eslintConfig = readJson(tree, '.eslintrc.json');
    expect(eslintConfig).toEqual({});
    expect(eslintConfig.rules).toBeUndefined();
  });

  it(`should add ignore @nx/react/plugins/storybook to eslint config`, async () => {
    tree.write('apps/main-webpack/tsconfig.json', `{}`);
    tree.write(
      `apps/main-webpack/.storybook/main.js`,
      `
      module.exports = {
        stories: ['../src/lib/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
        framework: {
          name: '@storybook/react-webpack5',
          options: {},
        },
      };
      `
    );

    updateJson(tree, '.eslintrc.json', (json) => {
      json.extends ??= [];
      json.extends.push('plugin:storybook/recommended');
      return json;
    });

    await eslintIgnoreReactPlugin(tree);

    const eslintConfig = readJson(tree, '.eslintrc.json');
    expect(eslintConfig.rules).toHaveProperty(
      'storybook/no-uninstalled-addons'
    );

    expect(eslintConfig.rules['storybook/no-uninstalled-addons']).toMatchObject(
      [
        'error',
        {
          ignore: ['@nx/react/plugins/storybook'],
        },
      ]
    );
  });
});

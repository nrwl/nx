import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as variousProjects from './test-configs/various-configs.json';
import addAddonEssentialsToAll from './add-addon-essentials-to-all';

describe('Add addon-essentials to project-level main.js files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addAllProjectsToWorkspace(tree);
  });

  it(`should add addon-essentials to main.js|ts where possible`, async () => {
    tree.write(
      '.storybook/main.js',
      `module.exports = {
        stories: [],
        addons: ['@storybook/addon-essentials', '@storybook/addon-knobs'],
      };
      `
    );
    await addAddonEssentialsToAll(tree);
    expect(
      tree.read('apps/main-vite/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/main-vite-ts/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/main-webpack/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup-3/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup-4/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-vite/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-vite-2/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should remove addon-essentials from root config file', async () => {
    tree.write(
      '.storybook/main.js',
      `module.exports = {
        stories: [],
        addons: ['@storybook/addon-essentials', '@storybook/addon-knobs'],
      };
      `
    );
    await addAddonEssentialsToAll(tree);
    expect(tree.read('.storybook/main.js', 'utf-8')).toMatchSnapshot();
  });

  it('should remove addon-essentials from root config typescript file', async () => {
    tree.write(
      '.storybook/main.ts',
      `
      import type { StorybookConfig } from '@storybook/core-common';

      export const rootMain: StorybookConfig = {
        addons: ['@storybook/addon-knobs', '@storybook/addon-essentials'],
      };
      `
    );
    await addAddonEssentialsToAll(tree);
    expect(tree.read('.storybook/main.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should delete the root config file if it only has addon-essentials', async () => {
    tree.write(
      '.storybook/main.js',
      `module.exports = {
        stories: [],
        addons: ['@storybook/addon-essentials'],
      };
      `
    );
    await addAddonEssentialsToAll(tree);
    expect(tree.exists('.storybook/main.js')).toBeFalsy();
  });

  it(`should remove the root config import and delete root file`, async () => {
    tree.write(
      '.storybook/main.js',
      `module.exports = {
        stories: [],
        addons: ['@storybook/addon-essentials'],
      };
      `
    );

    await addAddonEssentialsToAll(tree);
    expect(
      tree.read('apps/main-vite/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/main-vite-ts/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/main-webpack/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup-3/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-rollup-4/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-vite/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/react-vite-2/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();

    expect(tree.exists('.storybook/main.js')).toBeFalsy();
  });
});

export function addAllProjectsToWorkspace(tree: Tree) {
  for (const [name, project] of Object.entries(variousProjects)) {
    addProjectConfiguration(tree, name, project as ProjectConfiguration);
    if (project.targets['build-storybook']?.options?.configDir) {
      if (name === 'main-vite-ts') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.ts`,
          `
          import { rootMain } from '../../../.storybook/main';
          import type { StorybookConfig } from '@storybook/core-common';
          import { mergeConfig } from 'vite';
          import viteTsConfigPaths from 'vite-tsconfig-paths';

          const config: StorybookConfig = {
            ...rootMain,
            core: { ...rootMain.core, builder: '@storybook/builder-vite' },
            stories: [
              ...rootMain.stories,
              '../src/app/**/*.stories.mdx',
              '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
            ],
            addons: [...(rootMain.addons || [])],
            async viteFinal(config: any) {
              return mergeConfig(config, {
                plugins: [
                  viteTsConfigPaths({
                    root: '../../../',
                  }),
                ],
              });
            },
          };

          module.exports = config;
          `
        );
      } else if (name === 'main-vite') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
          const rootMain = require('../../../.storybook/main');
          const { mergeConfig } = require('vite');
          const viteTsConfigPaths = require('vite-tsconfig-paths').default;

          module.exports = {
            ...rootMain,
            core: { ...rootMain.core, builder: 'webpack5' },
            stories: [
              ...rootMain.stories,
              '../src/app/**/*.stories.mdx',
              '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
            ],
            async viteFinal(config, { configType }) {
              return mergeConfig(config, {
                plugins: [
                  viteTsConfigPaths({
                    root: '../../../',
                  }),
                ],
              });
            },
          };
          `
        );
      } else if (name === 'react-vite-2') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
        some invalid stuff
        `
        );
      } else if (name === 'react-rollup') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
          // project: ${name}
          const rootMain = require('../../../.storybook/main');
          // Use the following syntax to add addons!
          rootMain.addons.push('@storybook/addon-a11y');
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );

          module.exports = rootMain;

          module.exports.core = { ...module.exports.core, builder: 'webpack5' };
          `
        );
      } else if (name === 'react-rollup-3') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
          // project: ${name}
          const rootMain = require('../../../.storybook/main');
          // Use the following syntax to add addons!
          rootMain.addons.push();
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );

          module.exports = rootMain;

          module.exports.core = { ...module.exports.core, builder: 'webpack5' };
          `
        );
      } else if (name === 'react-rollup-4') {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
          // project: ${name}
          const rootMain = require('../../../.storybook/main');

          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );

          module.exports = rootMain;

          module.exports.core = { ...module.exports.core, builder: 'webpack5' };
          `
        );
      } else {
        tree.write(
          `${project.targets['build-storybook']?.options?.configDir}/main.js`,
          `
          const rootMain = require('../../../.storybook/main');
          const { mergeConfig } = require('vite');
          const viteTsConfigPaths = require('vite-tsconfig-paths').default;

          module.exports = {
            ...rootMain,
            core: { ...rootMain.core, builder: 'webpack5' },
            stories: [
              ...rootMain.stories,
              '../src/app/**/*.stories.mdx',
              '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
            ],
            addons: [...rootMain.addons, '@nrwl/react/plugins/storybook'],
            webpackFinal: async (config, { configType }) => {
              // apply any global webpack configs that might have been specified in .storybook/main.js
              if (rootMain.webpackFinal) {
                config = await rootMain.webpackFinal(config, { configType });
              }

              // add your own webpack tweaks if needed

              return config;
            },
            async viteFinal(config, { configType }) {
              return mergeConfig(config, {
                plugins: [
                  viteTsConfigPaths({
                    root: '../../../',
                  }),
                ],
              });
            },
          };
          `
        );
      }
    }
  }
}

import { readJson, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { migrateStorybookToWebPack5 } from './migrate-storybook-to-webpack-5';

describe('migrateStorybookToWebPack5', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add packages needed by Storybook if workspace has the @storybook/react package', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        '@storybook/react': '~6.3.0',
      };
      return json;
    });

    await migrateStorybookToWebPack5(tree);

    const json = readJson(tree, '/package.json');

    expect(json.devDependencies['@storybook/builder-webpack5']).toBe('~6.3.0');
    expect(json.devDependencies['@storybook/manager-webpack5']).toBe('~6.3.0');
  });

  it('should not add the webpack Storybook packages again if they already exist', async () => {
    let newTree = createTreeWithEmptyWorkspace();
    updateJson(newTree, 'package.json', (json) => {
      json.dependencies = {
        '@storybook/react': '~6.3.0',
        '@storybook/builder-webpack5': '~6.3.0',
        '@storybook/manager-webpack5': '~6.3.0',
      };
      return json;
    });
    await migrateStorybookToWebPack5(newTree);
    const json = readJson(newTree, '/package.json');
    expect(json.devDependencies['@storybook/builder-webpack5']).toBeUndefined();
    expect(json.devDependencies['@storybook/manager-webpack5']).toBeUndefined();
  });

  it('should not add Storybook packages if @storybook/react does not exist', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        '@storybook/angular': '~6.3.0',
      };
      return json;
    });
    await migrateStorybookToWebPack5(tree);
    const json = readJson(tree, '/package.json');
    expect(json.devDependencies['@storybook/builder-webpack5']).toBeUndefined();
    expect(json.devDependencies['@storybook/manager-webpack5']).toBeUndefined();
  });

  describe('updating project-level .storybook/main.js configurations for webpack 5', () => {
    beforeEach(async () => {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          '@storybook/react': '~6.3.0',
        };
        return json;
      });

      updateJson(tree, 'workspace.json', (json) => {
        json = {
          ...json,
          projects: {
            ...json.projects,
            'test-one': {
              targets: {
                storybook: {
                  options: {
                    uiFramework: '@storybook/react',
                    config: {
                      configFolder: 'libs/test-one/.storybook',
                    },
                  },
                },
              },
            },
            'test-two': {
              targets: {
                storybook: {
                  options: {
                    uiFramework: '@storybook/react',
                    config: {
                      configFolder: 'libs/test-two/.storybook',
                    },
                  },
                },
              },
            },
          },
        };
        return json;
      });

      tree.write(
        `.storybook/main.js`,
        `module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials'],
          // uncomment the property below if you want to apply some webpack config globally
          // webpackFinal: async (config, { configType }) => {
          //   // Make whatever fine-grained changes you need that should apply to all storybook configs
        
          //   // Return the altered config
          //   return config;
          // },
        };
        `
      );
    });

    describe('when main.js uses new syntax', () => {
      it('should update the project-level .storybook/main.js if there is a core object', async () => {
        tree.write(
          `libs/test-one/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
        ...rootMain,
  
        core: { ...rootMain.core },
        stories: [
          ...rootMain.stories,
          '../src/lib/**/*.stories.mdx',
          '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
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
      };`
        );

        tree.write(
          `libs/test-two/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
        ...rootMain,
        core: { ...rootMain.core },
        stories: [
          ...rootMain.stories,
          '../src/lib/**/*.stories.mdx',
          '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
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
      };`
        );

        await migrateStorybookToWebPack5(tree);

        const projectOne = tree.read(
          `libs/test-one/.storybook/main.js`,
          'utf-8'
        );
        expect(projectOne).toContain(`builder: 'webpack5'`);
        const projectTwo = tree.read(
          `libs/test-two/.storybook/main.js`,
          'utf-8'
        );
        expect(projectTwo).toContain(`builder: 'webpack5'`);
      });

      it('should update the project-level .storybook/main.js if there is not a core object', async () => {
        tree.write(
          `libs/test-one/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
        ...rootMain,
  
        stories: [
          ...rootMain.stories,
          '../src/lib/**/*.stories.mdx',
          '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
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
      };`
        );

        tree.write(
          `libs/test-two/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
        ...rootMain,
  
        stories: [
          ...rootMain.stories,
          '../src/lib/**/*.stories.mdx',
          '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
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
      };`
        );

        await migrateStorybookToWebPack5(tree);
        const projectOne = tree.read(
          `libs/test-one/.storybook/main.js`,
          'utf-8'
        );
        expect(projectOne).toContain(`builder: 'webpack5'`);
        const projectTwo = tree.read(
          `libs/test-two/.storybook/main.js`,
          'utf-8'
        );
        expect(projectTwo).toContain(`builder: 'webpack5'`);
      });

      it('should not do anything if project-level .storybook/main.js is invalid', async () => {
        tree.write(
          `libs/test-one/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
      };`
        );

        tree.write(
          `libs/test-two/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');
      module.exports = {
        ...rootMain,
        },
      };`
        );

        await migrateStorybookToWebPack5(tree);
        const projectOne = tree.read(
          `libs/test-one/.storybook/main.js`,
          'utf-8'
        );
        expect(projectOne).not.toContain(`builder: 'webpack5'`);
        const projectTwo = tree.read(
          `libs/test-two/.storybook/main.js`,
          'utf-8'
        );
        expect(projectTwo).not.toContain(`builder: 'webpack5'`);
      });
    });

    describe('when main.js uses old syntax', () => {
      it('should update the project-level .storybook/main.js if there is a core object', async () => {
        tree.write(
          `libs/test-one/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');

          rootMain.core = { 
            ...rootMain.core
          };
          // Use the following syntax to add addons!
          // rootMain.addons.push('');
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );
          module.exports = rootMain;`
        );

        tree.write(
          `libs/test-two/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');

          rootMain.core = { ...rootMain.core, builder: 'webpack5' };
          // Use the following syntax to add addons!
          // rootMain.addons.push('');
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );
          module.exports = rootMain;`
        );

        await migrateStorybookToWebPack5(tree);

        const projectOne = tree.read(
          `libs/test-one/.storybook/main.js`,
          'utf-8'
        );
        expect(projectOne).toContain(`builder: 'webpack5'`);
        const projectTwo = tree.read(
          `libs/test-two/.storybook/main.js`,
          'utf-8'
        );
        expect(projectTwo).toContain(`builder: 'webpack5'`);
      });

      it('should update the project-level .storybook/main.js if there is not a core object', async () => {
        tree.write(
          `libs/test-one/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');

          // Use the following syntax to add addons!
          // rootMain.addons.push('');
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );
          module.exports = rootMain;`
        );

        tree.write(
          `libs/test-two/.storybook/main.js`,
          `const rootMain = require('../../../.storybook/main');

          // Use the following syntax to add addons!
          // rootMain.addons.push('');
          rootMain.stories.push(
            ...['../src/lib/**/*.stories.mdx', '../src/lib/**/*.stories.@(js|jsx|ts|tsx)']
          );
          module.exports = rootMain;`
        );

        await migrateStorybookToWebPack5(tree);
        const projectOne = tree.read(
          `libs/test-one/.storybook/main.js`,
          'utf-8'
        );
        expect(projectOne).toContain(`builder: 'webpack5'`);
        const projectTwo = tree.read(
          `libs/test-two/.storybook/main.js`,
          'utf-8'
        );
        expect(projectTwo).toContain(`builder: 'webpack5'`);
      });
    });
  });
});

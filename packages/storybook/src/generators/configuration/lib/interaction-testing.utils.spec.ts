import { ProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addInteractionsInAddons } from './interaction-testing.utils';
describe('Helper functions for the Storybook 7 migration generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add addon-interactions in main.ts if it does not exist', () => {
    tree.write(
      `.storybook/main.ts`,
      `import type { StorybookConfig } from '@storybook/angular';
    
            const config: StorybookConfig = {
              stories: ['../**/*.stories.@(js|jsx|ts|tsx|mdx)'],
              addons: ['@storybook/addon-essentials'],
              framework: {
                name: '@storybook/angular',
                options: {},
              },
            };
            
            export default config;`
    );
    addInteractionsInAddons(tree, {
      name: 'my-proj',
      targets: {
        storybook: {
          executor: '@nx/storybook:storybook',
          options: {
            configDir: `.storybook`,
          },
        },
      },
    } as unknown as ProjectConfiguration);
    expect(tree.read(`.storybook/main.ts`, 'utf-8')).toMatchSnapshot();
  });

  it('should do nothing if addon-interactions already exists in main.ts', () => {
    tree.write(
      `.storybook/main.ts`,
      `import type { StorybookConfig } from '@storybook/angular';
    
            const config: StorybookConfig = {
              stories: ['../**/*.stories.@(js|jsx|ts|tsx|mdx)'],
              addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
              framework: {
                name: '@storybook/angular',
                options: {},
              },
            };
            
            export default config;`
    );
    addInteractionsInAddons(tree, {
      name: 'my-proj',
      targets: {
        storybook: {
          executor: '@nx/storybook:storybook',
          options: {
            configDir: `.storybook`,
          },
        },
      },
    } as unknown as ProjectConfiguration);
    expect(tree.read(`.storybook/main.ts`, 'utf-8')).toMatchSnapshot();
  });
});

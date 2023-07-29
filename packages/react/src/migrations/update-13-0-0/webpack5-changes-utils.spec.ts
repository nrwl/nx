import { addProjectConfiguration, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { allReactProjectsWithStorybookConfiguration } from './webpack5-changes-utils';

describe('webpack5ChangesUtils', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should get project name and storybook configuration for all react projects', () => {
    addProjectConfiguration(tree, 'test-one', {
      root: 'libs/test-one',
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
    });
    addProjectConfiguration(tree, 'test-two', {
      root: 'libs/test-two',
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
    });
    const allReactProjects = allReactProjectsWithStorybookConfiguration(tree);

    expect(allReactProjects).toMatchSnapshot();
  });

  it('should ignore non-react projects with storybook configuration', () => {
    addProjectConfiguration(tree, 'test-one', {
      root: 'libs/test-one',
      targets: {
        storybook: {
          options: {
            uiFramework: '@storybook/angular',
            config: {
              configFolder: 'libs/test-one/.storybook',
            },
          },
        },
      },
    });

    const allReactProjects = allReactProjectsWithStorybookConfiguration(tree);
    expect(allReactProjects.length).toBe(0);
  });
});

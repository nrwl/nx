import { Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { allReactProjectsWithStorybookConfiguration } from '@nrwl/react/src/migrations/update-13-0-0/webpack5-changes-utils';

describe('webpack5ChangesUtils', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should get project name and storybook configuration for all react projects', () => {
    const projects = {
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
    };
    updateJson(tree, 'workspace.json', (json) => {
      json = {
        ...json,
        projects: {
          ...json.projects,
          ...projects,
        },
      };
      return json;
    });

    const allReactProjects = allReactProjectsWithStorybookConfiguration(tree);

    expect(allReactProjects).toMatchSnapshot();
  });

  it('should ignore non-react projects with storybook configuration', () => {
    updateJson(tree, 'workspace.json', (json) => {
      json = {
        ...json,
        projects: {
          ...json.projects,
          'test-one': {
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
          },
        },
      };
      return json;
    });

    const allReactProjects = allReactProjectsWithStorybookConfiguration(tree);
    expect(allReactProjects.length).toBe(0);
  });
});

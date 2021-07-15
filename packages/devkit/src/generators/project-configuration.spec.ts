import { Tree } from '@nrwl/tao/src/shared/tree';
import {
  readProjectConfiguration,
  addProjectConfiguration,
  updateProjectConfiguration,
  removeProjectConfiguration,
  getProjects,
} from './project-configuration';
import { createTreeWithEmptyWorkspace } from '../tests/create-tree-with-empty-workspace';
import { ProjectConfiguration } from '@nrwl/tao/src/shared/workspace';
import { readJson } from '../utils/json';

const baseTestProjectConfig: ProjectConfiguration = {
  root: 'libs/test',
  sourceRoot: 'libs/test/src',
  targets: {},
};

describe('project configuration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should create project.json file when adding a project if standalone is true', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, true);

    expect(tree.exists('libs/test/project.json')).toBeTruthy();
  });

  it('should create project.json file if all other apps in the workspace use project.json', () => {
    addProjectConfiguration(
      tree,
      'project-a',
      {
        root: 'apps/project-a',
        targets: {},
      },
      true
    );
    addProjectConfiguration(
      tree,
      'project-b',
      {
        root: 'apps/project-b',
        targets: {},
      },
      true
    );
    expect(tree.exists('apps/project-b/project.json')).toBeTruthy();
  });

  it("should not create project.json file if any other app in the workspace doesn't use project.json", () => {
    addProjectConfiguration(tree, 'project-a', {
      root: 'apps/project-a',
      targets: {},
    });
    addProjectConfiguration(tree, 'project-b', {
      root: 'apps/project-b',
      targets: {},
    });
    expect(tree.exists('apps/project-a/project.json')).toBeFalsy();
    expect(tree.exists('apps/project-b/project.json')).toBeFalsy();
  });

  it('should not create project.json file when adding a project if standalone is false', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, false);

    expect(tree.exists('libs/test/project.json')).toBeFalsy();
  });

  it('should be able to read from standalone projects', () => {
    tree.write(
      'libs/test/project.json',
      JSON.stringify(baseTestProjectConfig, null, 2)
    );
    tree.write(
      'workspace.json',
      JSON.stringify(
        {
          projects: {
            test: 'libs/test',
          },
        },
        null,
        2
      )
    );

    const projectConfig = readProjectConfiguration(tree, 'test');

    expect(projectConfig).toEqual(baseTestProjectConfig);
  });

  it('should update project.json file when updating a project', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, true);
    const expectedProjectConfig = {
      ...baseTestProjectConfig,
      targets: { build: { executor: '' } },
    };
    updateProjectConfiguration(tree, 'test', expectedProjectConfig);

    expect(readJson(tree, 'libs/test/project.json')).toEqual(
      expectedProjectConfig
    );
  });

  it('should update workspace.json file when updating an inline project', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, false);
    const expectedProjectConfig = {
      ...baseTestProjectConfig,
      targets: { build: { executor: '' } },
    };
    updateProjectConfiguration(tree, 'test', expectedProjectConfig);

    expect(readJson(tree, 'workspace.json').projects.test).toEqual(
      expectedProjectConfig
    );
  });

  it('should remove project.json file when removing project configuration', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, true);
    removeProjectConfiguration(tree, 'test');

    expect(readJson(tree, 'workspace.json').projects.test).toBeUndefined();
    expect(tree.exists('test/project.json')).toBeFalsy();
  });

  it('should support workspaces with standalone and inline projects', () => {
    addProjectConfiguration(tree, 'test', baseTestProjectConfig, true);
    addProjectConfiguration(tree, 'test2', baseTestProjectConfig, false);
    const configurations = getProjects(tree);
    expect(configurations.get('test')).toEqual(baseTestProjectConfig);
    expect(configurations.get('test2')).toEqual(baseTestProjectConfig);
  });
});

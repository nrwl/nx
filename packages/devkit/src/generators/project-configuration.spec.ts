import { Tree } from '@nrwl/tao/src/shared/tree';
import { ProjectConfiguration } from '@nrwl/tao/src/shared/workspace';

import { createTreeWithEmptyWorkspace } from '../tests/create-tree-with-empty-workspace';
import { readJson, updateJson } from '../utils/json';
import {
  addProjectConfiguration,
  getProjects,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
  WorkspaceConfiguration,
} from './project-configuration';
import { getWorkspacePath } from '../utils/get-workspace-layout';

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

  describe('readProjectConfiguration', () => {
    it('should get info from workspace.json', () => {
      updateJson(tree, getWorkspacePath(tree), (json) => {
        json.projects['proj1'] = {
          root: 'proj1',
        };
        return json;
      });

      const config = readProjectConfiguration(tree, 'proj1');
      expect(config).toEqual({
        root: 'proj1',
      });
    });

    it('should get info from nx.json', () => {
      updateJson(tree, getWorkspacePath(tree), (json) => {
        json.projects['proj1'] = {
          root: 'proj1',
        };
        return json;
      });
      updateJson(tree, 'nx.json', (json) => {
        json.projects['proj1'] = {
          tags: ['tag1'],
        };
        return json;
      });

      const config = readProjectConfiguration(tree, 'proj1');
      expect(config).toEqual({
        root: 'proj1',
        tags: ['tag1'],
      });
    });

    it('should should not fail if projects is not defined in nx.json', () => {
      updateJson(tree, getWorkspacePath(tree), (json) => {
        json.projects['proj1'] = {
          root: 'proj1',
        };
        return json;
      });
      updateJson(tree, 'nx.json', (json) => {
        delete json.projects;
        return json;
      });

      const config = readProjectConfiguration(tree, 'proj1');
      expect(config).toEqual({
        root: 'proj1',
      });
    });
  });

  describe('addProjectConfiguration', () => {
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

  describe('updateWorkspaceConfiguration', () => {
    let workspaceConfiguration: WorkspaceConfiguration;
    beforeEach(() => {
      workspaceConfiguration = readWorkspaceConfiguration(tree);
    });

    it('should update properties in workspace.json', () => {
      workspaceConfiguration.version = 3;

      updateWorkspaceConfiguration(tree, workspaceConfiguration);

      expect(readJson(tree, 'workspace.json').version).toEqual(3);
    });

    it('should update properties in nx.json', () => {
      workspaceConfiguration.npmScope = 'new-npmScope';

      updateWorkspaceConfiguration(tree, workspaceConfiguration);

      expect(readJson(tree, 'nx.json').npmScope).toEqual('new-npmScope');
    });

    it('should not update unknown properties', () => {
      workspaceConfiguration['$schema'] = 'schema';

      updateWorkspaceConfiguration(tree, workspaceConfiguration);

      expect(readJson(tree, 'workspace.json').$schema).not.toBeDefined();
      expect(readJson(tree, 'nx.json').$schema).not.toBeDefined();
    });

    it('should skip properties that are identical to the extends property', () => {
      workspaceConfiguration['$schema'] = 'schema';

      updateWorkspaceConfiguration(tree, workspaceConfiguration);

      expect(readJson(tree, 'workspace.json').$schema).not.toBeDefined();
      expect(readJson(tree, 'nx.json').$schema).not.toBeDefined();
    });
  });

  describe('without nx.json', () => {
    beforeEach(() => tree.delete('nx.json'));

    afterEach(() => expect(tree.exists('nx.json')).toEqual(false));

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
      addProjectConfiguration(
        tree,
        'project-a',
        {
          root: 'apps/project-a',
          targets: {},
        },
        false
      );
      addProjectConfiguration(
        tree,
        'project-b',
        {
          root: 'apps/project-b',
          targets: {},
        },
        false
      );
      expect(tree.exists('apps/project-a/project.json')).toBeFalsy();
      expect(tree.exists('apps/project-b/project.json')).toBeFalsy();
    });

    it('should not create project.json file when adding a project if standalone is false', () => {
      addProjectConfiguration(tree, 'test', baseTestProjectConfig, false);

      expect(tree.exists('libs/test/project.json')).toBeFalsy();
    });

    it('should be able to read from standalone projects', () => {
      tree.write(
        'workspace.json',
        JSON.stringify(
          {
            projects: {
              test: {
                root: '/libs/test',
              },
            },
          },
          null,
          2
        )
      );

      const projectConfig = readProjectConfiguration(tree, 'test');

      expect(projectConfig).toEqual({
        root: '/libs/test',
      });
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

      expect(tree.exists('test/project.json')).toBeFalsy();
    });

    it('should remove project configuration', () => {
      addProjectConfiguration(tree, 'test', baseTestProjectConfig, false);
      removeProjectConfiguration(tree, 'test');

      expect(readJson(tree, 'workspace.json').projects.test).toBeUndefined();
    });

    it('should support workspaces with standalone and inline projects', () => {
      addProjectConfiguration(tree, 'test', baseTestProjectConfig, true);
      addProjectConfiguration(tree, 'test2', baseTestProjectConfig, false);

      const configurations = getProjects(tree);

      expect(configurations.get('test')).toEqual(baseTestProjectConfig);
      expect(configurations.get('test2')).toEqual(baseTestProjectConfig);
    });
  });
});

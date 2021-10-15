import {
  Tree,
  writeJson,
  updateJson,
  readWorkspaceConfiguration,
  readJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './config-locations';

describe('update to v13 config locations', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace(2);
    updateJson(tree, 'workspace.json', (json) => ({
      ...json,
      cli: {
        defaultCollection: '@nrwl/workspace',
        packageManager: 'npm',
      },
      generators: {},
      defaultProject: 'a',
      projects: {
        a: {},
      },
    }));
    writeJson(tree, 'nx.json', {
      npmScope: 'test',
      projects: {
        a: {
          tags: ['test'],
        },
      },
    });
  });

  it('should move properties to correct place', async () => {
    await update(tree);
    const workspaceJson = readJson(tree, 'workspace.json');
    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.projects).not.toBeDefined();
    expect(nxJson.cli?.defaultCollection).toEqual('@nrwl/workspace');
    expect(nxJson.cli?.packageManager).toEqual('npm');
    expect(nxJson.generators).toEqual({});
    expect(workspaceJson.projects.a.tags).toEqual(['test']);
    expect(workspaceJson.cli).not.toBeDefined();
    expect(workspaceJson.defaultProject).not.toBeDefined();
  });

  describe('v1 workspace', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace(1);
      updateJson(tree, 'workspace.json', (json) => ({
        ...json,
        cli: {
          defaultCollection: '@nrwl/workspace',
          packageManager: 'npm',
        },
        schematics: {
          '@nrwl/workspace:lib': {
            name: 'This is a wierd default',
          },
        },
        defaultProject: 'a',
        projects: {
          a: {},
        },
      }));
      writeJson(tree, 'nx.json', {
        npmScope: 'test',
        projects: {
          a: {
            tags: ['test'],
          },
        },
      });
    });

    it('should move properties to correct place', async () => {
      await update(tree);
      const workspaceJson = readJson(tree, 'workspace.json');
      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.projects).not.toBeDefined();
      expect(nxJson.cli?.defaultCollection).toEqual('@nrwl/workspace');
      expect(nxJson.cli?.packageManager).toEqual('npm');
      expect(nxJson.generators).toEqual({
        '@nrwl/workspace:lib': {
          name: 'This is a wierd default',
        },
      });
      expect(workspaceJson.projects.a.tags).toEqual(['test']);
      expect(workspaceJson.cli).not.toBeDefined();
      expect(workspaceJson.defaultProject).not.toBeDefined();
    });
  });
});

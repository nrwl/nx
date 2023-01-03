import { Tree, writeJson, updateJson, readJson } from '@nrwl/devkit';
import {
  createTreeWithEmptyV1Workspace,
  createTreeWithEmptyWorkspace,
} from '@nrwl/devkit/testing';
import update from './config-locations';

describe('update to v13 config locations', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('workspace.json', JSON.stringify({ version: 2, projects: {} }));
    updateJson(tree, 'workspace.json', (json) => ({
      ...json,
      cli: {
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
    expect(nxJson.cli?.packageManager).toEqual('npm');
    expect(nxJson.generators).toEqual({});
    expect(workspaceJson.projects.a.tags).toEqual(['test']);
    expect(workspaceJson.cli).not.toBeDefined();
  });

  describe('v1 workspace', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyV1Workspace();
      updateJson(tree, 'workspace.json', (json) => ({
        ...json,
        cli: {
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
      expect(nxJson.cli?.packageManager).toEqual('npm');
      expect(nxJson.generators).toEqual({
        '@nrwl/workspace:lib': {
          name: 'This is a wierd default',
        },
      });
      expect(workspaceJson.projects.a.tags).toEqual(['test']);
      expect(workspaceJson.cli).not.toBeDefined();
    });
  });
});

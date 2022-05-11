import { Tree } from '../../generators/tree';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from '../../generators/utils/project-configuration';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import removeRoots from './remove-roots';

describe('remove-roots >', () => {
  let tree: Tree;

  describe('projects with project.json configs', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace(2);
    });

    it('should remove the root property', async () => {
      addProjectConfiguration(tree, 'proj1', {
        root: 'proj1',
      });

      updateJson(tree, 'proj1/project.json', (config) => ({
        ...config,
        root: 'proj1',
      }));

      await removeRoots(tree);

      expect(readJson(tree, 'proj1/project.json').root).toBeUndefined();
    });
  });

  describe('projects with workspace.json configs', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace(1);
    });

    it('should remove the root property', async () => {
      addProjectConfiguration(tree, 'proj1', {
        root: 'proj1',
      });

      await removeRoots(tree);

      expect(readJson(tree, 'workspace.json').projects.proj1.root).toEqual(
        'proj1'
      );
    });
  });

  describe('projects with package.json configs', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace(2);
    });

    it('should remove the root property', async () => {
      writeJson(tree, 'proj1/package.json', {
        name: 'proj1',
      });

      await removeRoots(tree);

      expect(readJson(tree, 'proj1/package.json')).toEqual({
        name: 'proj1',
      });
    });
  });
});

import { createTree } from '../../generators/testing-utils/create-tree';
import update from './rm-default-collection-npm-scope';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { Tree } from '../../generators/tree';

describe('rm-default-collection-npm-scope migration', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTree();
  });

  describe('with nx.json', () => {
    beforeEach(() => {
      writeJson(tree, 'nx.json', {
        affected: {
          defaultBase: 'master',
        },
        npmScope: 'scope',
        cli: {
          defaultCollection: 'collection',
        },
      } as NxJsonConfiguration & { npmScope: string; cli: { defaultCollection: string } });
    });

    it('should remove npmScope', async () => {
      await update(tree);
      expect(readJson(tree, 'nx.json').npmScope).not.toBeDefined();
    });

    it('should remove defaultCollection', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.cli.packageManager = 'npm';
        return json;
      });
      await update(tree);
      expect(readJson(tree, 'nx.json').cli).toEqual({
        packageManager: 'npm',
      });
    });

    it('should remove cli', async () => {
      await update(tree);
      expect(readJson(tree, 'nx.json').cli).not.toBeDefined();
    });
  });

  describe('without nx.json', () => {
    it('should run successfully', async () => {
      await update(tree);
    });
  });
});

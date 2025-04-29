import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import update from './remove-use-legacy-cache';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

describe('remove useLegacyCache', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove `useLegacyCache` from nx.json', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      useLegacyCache: true,
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "affected": {
          "defaultBase": "main",
        },
        "targetDefaults": {
          "build": {
            "cache": true,
          },
          "lint": {
            "cache": true,
          },
        },
      }
    `);
  });
});

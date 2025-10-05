import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import update from './use-legacy-cache';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

describe('use legacy cache', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add `useLegacyCache` on migrating workspaces that did not have `enableDbCache`', async () => {
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
        "useLegacyCache": true,
      }
    `);
  });
  it('should not add `useLegacyCache` on migrating workspaces that did have `enableDbCache`', async () => {
    const nxJson = readNxJson(tree);
    updateNxJson(tree, {
      enableDbCache: true,
      ...nxJson,
    } as any);

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

import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import migrate from './disable-crystal-for-existing-workspaces';

describe('disable crystal for existing workspaces', () => {
  it('should add flag to nx.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await migrate(tree);
    expect(tree.read('nx.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "affected": {
          "defaultBase": "main"
        },
        "targetDefaults": {
          "build": {
            "cache": true
          },
          "lint": {
            "cache": true
          }
        },
        "useInferencePlugins": false
      }
      "
    `);
  });
});

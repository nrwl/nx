import '../../internal-testing-utils/mock-prettier';

import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson, updateJson } from '../../generators/utils/json';
import type { Tree } from '../../generators/tree';
import migrate from './consolidate-release-tag-config';

/**
 * The v23 migration is a thin re-export of the v22 consolidation. This spec
 * pins the delegation so a future rename or refactor of the v22 file fails
 * loudly here instead of shipping silently. Exhaustive coverage of the
 * consolidation logic lives in update-22-0-0/consolidate-release-tag-config.spec.ts.
 */
describe('update-23-0-0 consolidate-release-tag-config migration', () => {
  it('should move legacy releaseTagPattern into releaseTag.pattern', async () => {
    const tree: Tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json) => {
      json.release = { releaseTagPattern: 'v{version}' };
      return json;
    });

    await migrate(tree);

    expect(readJson(tree, 'nx.json').release).toEqual({
      releaseTag: { pattern: 'v{version}' },
    });
  });
});

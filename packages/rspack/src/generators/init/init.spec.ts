import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { rspackInitGenerator } from './init';

describe('rspackInitGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should deny the @parcel/watcher build script pulled in by sass', async () => {
    await withPnpm(tree, '11.2.2', () =>
      rspackInitGenerator(tree, { addPlugin: true })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]@parcel\/watcher['"]: false/
    );
  });
});

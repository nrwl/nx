import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateNextConfig } from './update-next-config';

describe('UpdateNextConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  // TODO: Add tests
  it('should work', () => {
    expect(true).toBe(true);
  });
});

import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import setupGenerator from './setup.impl';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      '.gitignore',
      `/node_modules
/dist`
    );
  });

  it('should update ignore file', async () => {
    // Idempotency
    await setupGenerator(tree);
    await setupGenerator(tree);

    const ignoreFile = tree.read('.gitignore').toString();
    expect(ignoreFile).toEqual(`node_modules
dist
# Remix files
apps/**/build
apps/**/.cache
  `);
  });
});

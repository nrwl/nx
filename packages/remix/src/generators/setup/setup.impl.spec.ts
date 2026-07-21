import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { Tree, updateJson } from '@nx/devkit';
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

  it('throws when the workspace declares TypeScript 6', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, typescript: '~6.0.3' };
      return json;
    });

    await expect(setupGenerator(tree)).rejects.toThrow(
      /does not support TypeScript 6/
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

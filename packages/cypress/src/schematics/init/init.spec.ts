import { Tree } from '@angular-devkit/schematics';

import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { runSchematic } from '../../utils/testing';

describe('init', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should add dependencies into `package.json` file', async () => {
    const tree = await runSchematic('init', {}, appTree);
    const packageJson = readJsonInTree(tree, 'package.json');

    expect(packageJson.devDependencies.cypress).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/cypress']).toBeDefined();
  });
});

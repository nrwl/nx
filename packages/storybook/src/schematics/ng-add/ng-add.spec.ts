import { Tree } from '@angular-devkit/schematics';

import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { runSchematic } from '../../utils/testing';

describe('ng-add', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should add dependencies into `package.json` file', async () => {
    const tree = await runSchematic('ng-add', {}, appTree);
    const packageJson = readJsonInTree(tree, 'package.json');
    expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toBeDefined();
    expect(
      packageJson.devDependencies['@types/storybook__addon-knobs']
    ).toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).toBeDefined();
  });
});

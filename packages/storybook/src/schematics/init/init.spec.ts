import { Tree } from '@angular-devkit/schematics';

import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { callRule, runSchematic } from '../../utils/testing';
import { storybookVersion } from '../../utils/versions';

describe('init', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should add dependencies into `package.json` file', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    await callRule(
      addDepsToPackageJson(
        { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion },
        false
      ),
      appTree
    );
    const tree = await runSchematic('init', {}, appTree);
    const packageJson = readJsonInTree(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
    expect(packageJson.devDependencies['@storybook/react']).toBeDefined();
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });
});

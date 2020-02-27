import { Tree } from '@angular-devkit/schematics';

import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { callRule, runSchematic } from '../../utils/testing';
import { cypressVersion } from '../../utils/versions';

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
        { '@nrwl/cypress': cypressVersion, [existing]: existingVersion },
        { [existing]: existingVersion },
        false
      ),
      appTree
    );
    const tree = await runSchematic('init', {}, appTree);
    const packageJson = readJsonInTree(tree, 'package.json');

    expect(packageJson.devDependencies.cypress).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/cypress']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies['@nrwl/cypress']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });
});

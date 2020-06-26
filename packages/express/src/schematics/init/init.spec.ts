import { Tree } from '@angular-devkit/schematics';
import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic, callRule } from '../../utils/testing';
import { expressVersion } from '../../utils/versions';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should add dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    await callRule(
      addDepsToPackageJson(
        { '@nrwl/express': expressVersion, [existing]: existingVersion },
        { [existing]: existingVersion },
        false
      ),
      tree
    );
    const result = await runSchematic('init', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');
    // add express
    expect(packageJson.dependencies['express']).toBeDefined();
    // move `@nrwl/express` to dev
    expect(packageJson.dependencies['@nrwl/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/express']).toBeDefined();
    // add express types
    expect(packageJson.devDependencies['@types/express']).toBeDefined();
    // keep existing packages
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/express');
    });
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    const result = await runSchematic(
      'init',
      {
        unitTestRunner: 'none',
      },
      tree
    );
    expect(result.exists('jest.config.js')).toEqual(false);
  });
});

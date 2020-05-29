import { Tree } from '@angular-devkit/schematics';
import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { nxVersion } from '../../utils/versions';

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
        { '@nrwl/node': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion },
        false
      ),
      tree
    );
    const result = await runSchematic('init', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.dependencies['@nrwl/node']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/node');
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

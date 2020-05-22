import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import { callRule, runSchematic } from '../../utils/testing';
import { nxVersion } from '../../utils/versions';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should add web dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    await callRule(
      addDepsToPackageJson(
        { '@nrwl/web': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion },
        false
      ),
      tree
    );
    const result = await runSchematic('init', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.devDependencies['@nrwl/web']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies['@nrwl/web']).toBeUndefined();
    expect(packageJson.dependencies['document-register-element']).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/web');
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
    expect(result.exists('jest.config.js')).toBe(false);
  });

  describe('babel config', () => {
    it('should create babel config if not present', async () => {
      const result = await runSchematic(
        'init',
        {
          unitTestRunner: 'none',
        },
        tree
      );
      expect(result.exists('babel.config.json')).toBe(true);
    });

    it('should not overwrite existing babel config', async () => {
      tree.create('babel.config.json', '{ "preset": ["preset-awesome"] }');

      const result = await runSchematic(
        'init',
        {
          unitTestRunner: 'none',
        },
        tree
      );

      const existing = result.read('babel.config.json').toString();
      expect(existing).toMatch('{ "preset": ["preset-awesome"] }');
    });

    it('should not overwrite existing babel config (.js)', async () => {
      tree.create('/babel.config.js', 'module.exports = () => {};');
      const result = await runSchematic(
        'init',
        {
          unitTestRunner: 'none',
        },
        tree
      );
      expect(result.exists('babel.config.json')).toBe(false);
    });
  });
});

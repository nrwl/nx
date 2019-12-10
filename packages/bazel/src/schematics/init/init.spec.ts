import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../utils/testing';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';

describe('@nrwl/bazel:sync', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree.create('.gitignore', '');
  });

  describe('.bazelrc', () => {
    it('should be created', async () => {
      const result = await runSchematic('init', {}, tree);

      expect(result.exists('.bazelrc')).toEqual(true);
    });
  });

  describe('@bazel dependencies', () => {
    it('should be added', async () => {
      const result = await runSchematic('init', {}, tree);

      const packageJson = readJsonInTree(result, 'package.json');
      expect(packageJson.devDependencies['@bazel/bazel']).toBeDefined();
      expect(packageJson.devDependencies['@bazel/ibazel']).toBeDefined();
    });
  });

  describe('.gitignore', () => {
    it('should have "bazel-*" added', async () => {
      const result = await runSchematic('init', {}, tree);

      const gitignore = result.readContent('.gitignore');
      expect(gitignore).toContain('bazel-*');
    });
  });
});

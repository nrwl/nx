import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from 'packages/linter/src/generators/utils/linter';

import detoxApplicationGenerator from './application';

describe('detox application generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  describe('app at root', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-app', {
        root: 'my-app',
      });

      await detoxApplicationGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.None,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('apps/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/app.spec.ts')).toBeTruthy();
    });

    it('should add update `workspace.json` file', async () => {
      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-app-e2e'];

      expect(project.root).toEqual('apps/my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-app']);
    });
  });

  describe('with directory specified', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        name: 'my-app-e2e',
        directory: 'my-dir',
        project: 'my-dir-my-app',
        linter: Linter.None,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('apps/my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(
        tree.exists('apps/my-dir/my-app-e2e/src/app.spec.ts')
      ).toBeTruthy();
    });

    it('should add update `workspace.json` file', async () => {
      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-dir-my-app-e2e'];

      expect(project.root).toEqual('apps/my-dir/my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('with directory in name', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        name: 'my-dir/my-app-e2e',
        project: 'my-dir-my-app',
        linter: Linter.None,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('apps/my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(
        tree.exists('apps/my-dir/my-app-e2e/src/app.spec.ts')
      ).toBeTruthy();
    });

    it('should add update `workspace.json` file', async () => {
      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-dir-my-app-e2e'];

      expect(project.root).toEqual('apps/my-dir/my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('tsconfig', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-app', { root: 'my-app' });
    });

    it('should extend from tsconfig.base.json', async () => {
      await detoxApplicationGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.None,
      });

      const tsConfig = readJson(tree, 'apps/my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toEqual('../../tsconfig.base.json');
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await detoxApplicationGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.None,
      });

      const tsConfig = readJson(tree, 'apps/my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toEqual('../../tsconfig.json');
    });
  });
});

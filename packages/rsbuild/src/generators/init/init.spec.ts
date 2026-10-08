import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readNxJson, updateJson, writeJson, type Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator, initGeneratorInternal } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('pnpm 11 build scripts', () => {
    function declareRsbuildCore(version: string) {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          '@rsbuild/core': version,
        };
        return json;
      });
    }

    it('should deny the core-js build script when @rsbuild/core v1 is installed', async () => {
      declareRsbuildCore('^1.4.0');

      await withPnpm(tree, '11.2.2', () => initGenerator(tree, {}));

      expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
        /['"]?core-js['"]?: false/
      );
    });

    it('should not record a core-js decision when @rsbuild/core v2 is installed', async () => {
      declareRsbuildCore('^2.0.0');

      await withPnpm(tree, '11.2.2', () => initGenerator(tree, {}));

      expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
    });

    it('should not record a core-js decision when @rsbuild/core is not installed', async () => {
      await withPnpm(tree, '11.2.2', () => initGenerator(tree, {}));

      expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
    });
  });

  it('should register @nx/js/typescript in a TS solution setup', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    tree.write('pnpm-workspace.yaml', `packages:\n  - 'packages/*'\n`);
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });

    await initGeneratorInternal(tree, { addPlugin: true });

    expect(readNxJson(tree).plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx/js/typescript' })
    );
  });
});

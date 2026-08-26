import { updateJson, type Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

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

      expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
        'core-js'
      );
    });

    it('should not record a core-js decision when @rsbuild/core is not installed', async () => {
      await withPnpm(tree, '11.2.2', () => initGenerator(tree, {}));

      expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
        'core-js'
      );
    });
  });
});

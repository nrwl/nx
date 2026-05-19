import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/eslint/internal', () => {
      const source = `import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { useFlatConfig } from '@nx/eslint/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/eslint', () => {
      const source = `import { lintProjectGenerator } from '@nx/eslint/src/generators/lint-project/lint-project';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { lintProjectGenerator } from '@nx/eslint';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const source = `import { lintProjectGenerator, useFlatConfig } from '@nx/eslint/src/utils/flat-config';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { lintProjectGenerator } from '@nx/eslint';`,
          `import { useFlatConfig } from '@nx/eslint/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('classifies aliased imports by their original name', () => {
      const source = `import { Linter as L, findEslintFile as f } from '@nx/eslint/src/generators/utils/eslint-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { Linter as L } from '@nx/eslint';`,
          `import { findEslintFile as f } from '@nx/eslint/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('preserves a type-only modifier when splitting', () => {
      const source = `import type { LinterType, Schema } from '@nx/eslint/src/executors/lint/schema';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import type { LinterType } from '@nx/eslint';`,
          `import type { Schema } from '@nx/eslint/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('rewrites a double-quoted import', () => {
      const source = `import { useFlatConfig } from "@nx/eslint/src/utils/flat-config";\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { useFlatConfig } from "@nx/eslint/internal";\n`
      );
    });

    it('routes a namespace import to @nx/eslint/internal', () => {
      const source = `import * as eslintFile from '@nx/eslint/src/generators/utils/eslint-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import * as eslintFile from '@nx/eslint/internal';\n`
      );
    });

    it('rewrites a public-symbol export-from to @nx/eslint', () => {
      const source = `export { lintInitGenerator } from '@nx/eslint/src/generators/init/init';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export { lintInitGenerator } from '@nx/eslint';\n`
      );
    });

    it('routes export * to @nx/eslint/internal', () => {
      const source = `export * from '@nx/eslint/src/utils/flat-config';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export * from '@nx/eslint/internal';\n`
      );
    });

    it('rewrites a CommonJS require() to the internal entry', () => {
      const source = `const { findEslintFile } = require('@nx/eslint/src/generators/utils/eslint-file');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const { findEslintFile } = require('@nx/eslint/internal');\n`
      );
    });

    it('rewrites a dynamic import() to the internal entry', () => {
      const source = `const mod = await import('@nx/eslint/src/utils/flat-config');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const mod = await import('@nx/eslint/internal');\n`
      );
    });

    it('rewrites a .js-extension subpath', () => {
      const source = `import { useFlatConfig } from '@nx/eslint/src/utils/flat-config.js';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { useFlatConfig } from '@nx/eslint/internal';\n`
      );
    });

    it('rewrites jest mock helpers to the internal entry', () => {
      const source = [
        `jest.doMock('@nx/eslint/src/utils/flat-config');`,
        `vi.importActual('@nx/eslint/src/generators/utils/eslint-file');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `jest.doMock('@nx/eslint/internal');`,
          `vi.importActual('@nx/eslint/internal');`,
          ``,
        ].join('\n')
      );
    });

    it('leaves the top-level @nx/eslint entry and @nx/eslint/plugin alone', () => {
      const source = [
        `import { Linter } from '@nx/eslint';`,
        `import { createNodesV2 } from '@nx/eslint/plugin';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves unrelated string literals and comments alone', () => {
      const source = [
        `const docs = 'see @nx/eslint/src/utils/flat-config for details';`,
        `// import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';`,
        `import { joinPathFragments } from '@nx/devkit';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves typeof import() type queries alone', () => {
      const source = `type X = typeof import('@nx/eslint/src/utils/flat-config');\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('returns the source unchanged when there are no matches', () => {
      const source = `import { something } from '@nx/devkit';\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });
  });

  describe('default export (Tree)', () => {
    it('rewrites imports across .ts files', async () => {
      tree.write(
        'apps/my-app/src/main.ts',
        `import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';\n`
      );
      await update(tree);
      const updated = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(updated).toContain('@nx/eslint/internal');
      expect(updated).not.toContain('@nx/eslint/src/utils/flat-config');
    });

    it('is a no-op for files that do not reference @nx/eslint/src/', async () => {
      const original = `import { joinPathFragments } from '@nx/devkit';\n`;
      tree.write('apps/my-app/src/main.ts', original);
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toBe(original);
    });
  });
});

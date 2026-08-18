import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/rollup-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/rollup/internal', () => {
      const src = `import { hasPlugin } from '@nx/rollup/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { hasPlugin } from '@nx/rollup/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/rollup', () => {
      const src = `import { createRollupOptions } from '@nx/rollup/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { createRollupOptions } from '@nx/rollup';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { createRollupOptions, hasPlugin } from '@nx/rollup/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { createRollupOptions } from '@nx/rollup';\nimport { hasPlugin } from '@nx/rollup/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { createRollupOptions as aliased } from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { createRollupOptions as aliased } from '@nx/rollup';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { createRollupOptions, hasPlugin } from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { createRollupOptions } from '@nx/rollup';\nimport type { hasPlugin } from '@nx/rollup/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { createRollupOptions, hasPlugin } from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { createRollupOptions } from '@nx/rollup';\nexport { hasPlugin } from '@nx/rollup/internal';\n`
      );
    });

    it('routes a namespace import to @nx/rollup/internal', () => {
      const src = `import * as ns from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/rollup/internal';\n`
      );
    });

    it('routes a default import to @nx/rollup/internal', () => {
      const src = `import thing from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/rollup/internal';\n`
      );
    });

    it('routes export * to @nx/rollup/internal', () => {
      const src = `export * from '@nx/rollup/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/rollup/internal';\n`
      );
    });

    it('routes require() to @nx/rollup/internal', () => {
      const src = `const m = require('@nx/rollup/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/rollup/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/rollup/internal', () => {
      const src = `const m = await import('@nx/rollup/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/rollup/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/rollup/internal', () => {
      const src = `let m: typeof import('@nx/rollup/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/rollup/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/rollup/src/x') as typeof import('@nx/rollup/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/rollup/internal') as typeof import('@nx/rollup/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/rollup/internal', () => {
      const src = `jest.mock('@nx/rollup/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/rollup/internal');\n`
      );
    });

    it('leaves non-@nx/rollup imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/rollup';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { hasPlugin } from '@nx/rollup/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/rollup/internal'`
    );
  });
});

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/esbuild-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/esbuild/internal', () => {
      const src = `import { getEntryPoints } from '@nx/esbuild/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { getEntryPoints } from '@nx/esbuild/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/esbuild', () => {
      const src = `import { configurationGenerator } from '@nx/esbuild/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { configurationGenerator } from '@nx/esbuild';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { configurationGenerator, getEntryPoints } from '@nx/esbuild/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { configurationGenerator } from '@nx/esbuild';\nimport { getEntryPoints } from '@nx/esbuild/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { configurationGenerator as aliased } from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { configurationGenerator as aliased } from '@nx/esbuild';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { configurationGenerator, getEntryPoints } from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { configurationGenerator } from '@nx/esbuild';\nimport type { getEntryPoints } from '@nx/esbuild/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { configurationGenerator, getEntryPoints } from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { configurationGenerator } from '@nx/esbuild';\nexport { getEntryPoints } from '@nx/esbuild/internal';\n`
      );
    });

    it('routes a namespace import to @nx/esbuild/internal', () => {
      const src = `import * as ns from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/esbuild/internal';\n`
      );
    });

    it('routes a default import to @nx/esbuild/internal', () => {
      const src = `import thing from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/esbuild/internal';\n`
      );
    });

    it('routes export * to @nx/esbuild/internal', () => {
      const src = `export * from '@nx/esbuild/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/esbuild/internal';\n`
      );
    });

    it('routes require() to @nx/esbuild/internal', () => {
      const src = `const m = require('@nx/esbuild/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/esbuild/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/esbuild/internal', () => {
      const src = `const m = await import('@nx/esbuild/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/esbuild/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/esbuild/internal', () => {
      const src = `let m: typeof import('@nx/esbuild/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/esbuild/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/esbuild/src/x') as typeof import('@nx/esbuild/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/esbuild/internal') as typeof import('@nx/esbuild/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/esbuild/internal', () => {
      const src = `jest.mock('@nx/esbuild/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/esbuild/internal');\n`
      );
    });

    it('leaves non-@nx/esbuild imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/esbuild';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { getEntryPoints } from '@nx/esbuild/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/esbuild/internal'`
    );
  });
});

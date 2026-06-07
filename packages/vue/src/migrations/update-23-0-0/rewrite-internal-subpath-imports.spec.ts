import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/vue-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/vue/internal', () => {
      const src = `import { waitForPortOpen } from '@nx/vue/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { waitForPortOpen } from '@nx/vue/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/vue', () => {
      const src = `import { applicationGenerator } from '@nx/vue/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/vue';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { applicationGenerator, waitForPortOpen } from '@nx/vue/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/vue';\nimport { waitForPortOpen } from '@nx/vue/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { applicationGenerator as aliased } from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator as aliased } from '@nx/vue';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { applicationGenerator, waitForPortOpen } from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { applicationGenerator } from '@nx/vue';\nimport type { waitForPortOpen } from '@nx/vue/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { applicationGenerator, waitForPortOpen } from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { applicationGenerator } from '@nx/vue';\nexport { waitForPortOpen } from '@nx/vue/internal';\n`
      );
    });

    it('routes a namespace import to @nx/vue/internal', () => {
      const src = `import * as ns from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/vue/internal';\n`
      );
    });

    it('routes a default import to @nx/vue/internal', () => {
      const src = `import thing from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/vue/internal';\n`
      );
    });

    it('routes export * to @nx/vue/internal', () => {
      const src = `export * from '@nx/vue/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/vue/internal';\n`
      );
    });

    it('routes require() to @nx/vue/internal', () => {
      const src = `const m = require('@nx/vue/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/vue/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/vue/internal', () => {
      const src = `const m = await import('@nx/vue/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/vue/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/vue/internal', () => {
      const src = `let m: typeof import('@nx/vue/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/vue/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/vue/src/x') as typeof import('@nx/vue/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/vue/internal') as typeof import('@nx/vue/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/vue/internal', () => {
      const src = `jest.mock('@nx/vue/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/vue/internal');\n`
      );
    });

    it('leaves non-@nx/vue imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/vue';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { waitForPortOpen } from '@nx/vue/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/vue/internal'`
    );
  });
});

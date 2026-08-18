import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/web-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/web/internal', () => {
      const src = `import { waitForPortOpen } from '@nx/web/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { waitForPortOpen } from '@nx/web/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/web', () => {
      const src = `import { webInitGenerator } from '@nx/web/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { webInitGenerator } from '@nx/web';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { webInitGenerator, waitForPortOpen } from '@nx/web/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { webInitGenerator } from '@nx/web';\nimport { waitForPortOpen } from '@nx/web/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { webInitGenerator as aliased } from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { webInitGenerator as aliased } from '@nx/web';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { webInitGenerator, waitForPortOpen } from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { webInitGenerator } from '@nx/web';\nimport type { waitForPortOpen } from '@nx/web/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { webInitGenerator, waitForPortOpen } from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { webInitGenerator } from '@nx/web';\nexport { waitForPortOpen } from '@nx/web/internal';\n`
      );
    });

    it('routes a namespace import to @nx/web/internal', () => {
      const src = `import * as ns from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/web/internal';\n`
      );
    });

    it('routes a default import to @nx/web/internal', () => {
      const src = `import thing from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/web/internal';\n`
      );
    });

    it('routes export * to @nx/web/internal', () => {
      const src = `export * from '@nx/web/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/web/internal';\n`
      );
    });

    it('routes require() to @nx/web/internal', () => {
      const src = `const m = require('@nx/web/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/web/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/web/internal', () => {
      const src = `const m = await import('@nx/web/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/web/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/web/internal', () => {
      const src = `let m: typeof import('@nx/web/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/web/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/web/src/x') as typeof import('@nx/web/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/web/internal') as typeof import('@nx/web/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/web/internal', () => {
      const src = `jest.mock('@nx/web/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/web/internal');\n`
      );
    });

    it('leaves non-@nx/web imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/web';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { waitForPortOpen } from '@nx/web/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/web/internal'`
    );
  });
});

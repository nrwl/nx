import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/react-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/react/internal', () => {
      const src = `import { waitForPortOpen } from '@nx/react/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { waitForPortOpen } from '@nx/react/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/react', () => {
      const src = `import { reactInitGenerator } from '@nx/react/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactInitGenerator } from '@nx/react';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { reactInitGenerator, waitForPortOpen } from '@nx/react/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactInitGenerator } from '@nx/react';\nimport { waitForPortOpen } from '@nx/react/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { reactInitGenerator as aliased } from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactInitGenerator as aliased } from '@nx/react';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { reactInitGenerator, waitForPortOpen } from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { reactInitGenerator } from '@nx/react';\nimport type { waitForPortOpen } from '@nx/react/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { reactInitGenerator, waitForPortOpen } from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { reactInitGenerator } from '@nx/react';\nexport { waitForPortOpen } from '@nx/react/internal';\n`
      );
    });

    it('routes a namespace import to @nx/react/internal', () => {
      const src = `import * as ns from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/react/internal';\n`
      );
    });

    it('routes a default import to @nx/react/internal', () => {
      const src = `import thing from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/react/internal';\n`
      );
    });

    it('routes export * to @nx/react/internal', () => {
      const src = `export * from '@nx/react/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/react/internal';\n`
      );
    });

    it('routes require() to @nx/react/internal', () => {
      const src = `const m = require('@nx/react/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/react/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/react/internal', () => {
      const src = `const m = await import('@nx/react/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/react/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/react/internal', () => {
      const src = `let m: typeof import('@nx/react/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/react/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/react/src/x') as typeof import('@nx/react/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/react/internal') as typeof import('@nx/react/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/react/internal', () => {
      const src = `jest.mock('@nx/react/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/react/internal');\n`
      );
    });

    it('leaves non-@nx/react imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/react';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { waitForPortOpen } from '@nx/react/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/react/internal'`
    );
  });
});

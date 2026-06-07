import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/next-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/next/internal', () => {
      const src = `import { nxVersion } from '@nx/next/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion } from '@nx/next/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/next', () => {
      const src = `import { applicationGenerator } from '@nx/next/src/generators/application/application';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/next';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { applicationGenerator, nxVersion } from '@nx/next/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/next';\nimport { nxVersion } from '@nx/next/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { applicationGenerator as aliased } from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator as aliased } from '@nx/next';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { applicationGenerator, nxVersion } from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { applicationGenerator } from '@nx/next';\nimport type { nxVersion } from '@nx/next/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { applicationGenerator, nxVersion } from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { applicationGenerator } from '@nx/next';\nexport { nxVersion } from '@nx/next/internal';\n`
      );
    });

    it('routes a namespace import to @nx/next/internal', () => {
      const src = `import * as ns from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/next/internal';\n`
      );
    });

    it('routes a default import to @nx/next/internal', () => {
      const src = `import thing from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/next/internal';\n`
      );
    });

    it('routes export * to @nx/next/internal', () => {
      const src = `export * from '@nx/next/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/next/internal';\n`
      );
    });

    it('routes require() to @nx/next/internal', () => {
      const src = `const m = require('@nx/next/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/next/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/next/internal', () => {
      const src = `const m = await import('@nx/next/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/next/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/next/internal', () => {
      const src = `let m: typeof import('@nx/next/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/next/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/next/src/x') as typeof import('@nx/next/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/next/internal') as typeof import('@nx/next/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/next/internal', () => {
      const src = `jest.mock('@nx/next/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/next/internal');\n`
      );
    });

    it('leaves non-@nx/next imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/next';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { nxVersion } from '@nx/next/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/next/internal'`
    );
  });
});

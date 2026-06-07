import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/express-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/express/internal', () => {
      const src = `import { expressVersion } from '@nx/express/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { expressVersion } from '@nx/express/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/express', () => {
      const src = `import { applicationGenerator } from '@nx/express/src/generators/application/application';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/express';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { applicationGenerator, expressVersion } from '@nx/express/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/express';\nimport { expressVersion } from '@nx/express/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { applicationGenerator as aliased } from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator as aliased } from '@nx/express';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { applicationGenerator, expressVersion } from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { applicationGenerator } from '@nx/express';\nimport type { expressVersion } from '@nx/express/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { applicationGenerator, expressVersion } from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { applicationGenerator } from '@nx/express';\nexport { expressVersion } from '@nx/express/internal';\n`
      );
    });

    it('routes a namespace import to @nx/express/internal', () => {
      const src = `import * as ns from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/express/internal';\n`
      );
    });

    it('routes a default import to @nx/express/internal', () => {
      const src = `import thing from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/express/internal';\n`
      );
    });

    it('routes export * to @nx/express/internal', () => {
      const src = `export * from '@nx/express/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/express/internal';\n`
      );
    });

    it('routes require() to @nx/express/internal', () => {
      const src = `const m = require('@nx/express/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/express/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/express/internal', () => {
      const src = `const m = await import('@nx/express/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/express/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/express/internal', () => {
      const src = `let m: typeof import('@nx/express/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/express/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/express/src/x') as typeof import('@nx/express/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/express/internal') as typeof import('@nx/express/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/express/internal', () => {
      const src = `jest.mock('@nx/express/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/express/internal');\n`
      );
    });

    it('leaves non-@nx/express imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/express';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { expressVersion } from '@nx/express/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/express/internal'`
    );
  });
});

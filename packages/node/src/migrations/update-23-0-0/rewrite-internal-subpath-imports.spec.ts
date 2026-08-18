import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/node-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/node/internal', () => {
      const src = `import { tslibVersion } from '@nx/node/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { tslibVersion } from '@nx/node/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/node', () => {
      const src = `import { applicationGenerator } from '@nx/node/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/node';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { applicationGenerator, tslibVersion } from '@nx/node/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator } from '@nx/node';\nimport { tslibVersion } from '@nx/node/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { applicationGenerator as aliased } from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { applicationGenerator as aliased } from '@nx/node';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { applicationGenerator, tslibVersion } from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { applicationGenerator } from '@nx/node';\nimport type { tslibVersion } from '@nx/node/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { applicationGenerator, tslibVersion } from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { applicationGenerator } from '@nx/node';\nexport { tslibVersion } from '@nx/node/internal';\n`
      );
    });

    it('routes a namespace import to @nx/node/internal', () => {
      const src = `import * as ns from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/node/internal';\n`
      );
    });

    it('routes a default import to @nx/node/internal', () => {
      const src = `import thing from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/node/internal';\n`
      );
    });

    it('routes export * to @nx/node/internal', () => {
      const src = `export * from '@nx/node/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/node/internal';\n`
      );
    });

    it('routes require() to @nx/node/internal', () => {
      const src = `const m = require('@nx/node/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/node/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/node/internal', () => {
      const src = `const m = await import('@nx/node/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/node/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/node/internal', () => {
      const src = `let m: typeof import('@nx/node/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/node/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/node/src/x') as typeof import('@nx/node/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/node/internal') as typeof import('@nx/node/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/node/internal', () => {
      const src = `jest.mock('@nx/node/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/node/internal');\n`
      );
    });

    it('leaves non-@nx/node imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/node';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { tslibVersion } from '@nx/node/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/node/internal'`
    );
  });
});

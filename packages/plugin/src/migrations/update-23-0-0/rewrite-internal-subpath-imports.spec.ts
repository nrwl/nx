import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

// `@nx/plugin`'s public entry (packages/plugin/index.ts) exports no symbols,
// so every `@nx/plugin/src/*` import is routed to `@nx/plugin/internal`.
describe('rewrite-@nx/plugin-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes a named import to @nx/plugin/internal', () => {
      const src = `import { nxVersion } from '@nx/plugin/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion } from '@nx/plugin/internal';\n`
      );
    });

    it('routes a multi-symbol named import to @nx/plugin/internal', () => {
      const src = `import { nxVersion, jsoncEslintParserVersion } from '@nx/plugin/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion, jsoncEslintParserVersion } from '@nx/plugin/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { nxVersion as aliased } from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion as aliased } from '@nx/plugin/internal';\n`
      );
    });

    it('preserves the type modifier', () => {
      const src = `import type { nxVersion } from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { nxVersion } from '@nx/plugin/internal';\n`
      );
    });

    it('routes export { ... } from to @nx/plugin/internal', () => {
      const src = `export { nxVersion } from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { nxVersion } from '@nx/plugin/internal';\n`
      );
    });

    it('routes a namespace import to @nx/plugin/internal', () => {
      const src = `import * as ns from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/plugin/internal';\n`
      );
    });

    it('routes a default import to @nx/plugin/internal', () => {
      const src = `import thing from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/plugin/internal';\n`
      );
    });

    it('routes export * to @nx/plugin/internal', () => {
      const src = `export * from '@nx/plugin/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/plugin/internal';\n`
      );
    });

    it('routes require() to @nx/plugin/internal', () => {
      const src = `const m = require('@nx/plugin/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/plugin/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/plugin/internal', () => {
      const src = `const m = await import('@nx/plugin/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/plugin/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/plugin/internal', () => {
      const src = `let m: typeof import('@nx/plugin/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/plugin/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/plugin/src/x') as typeof import('@nx/plugin/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/plugin/internal') as typeof import('@nx/plugin/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/plugin/internal', () => {
      const src = `jest.mock('@nx/plugin/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/plugin/internal');\n`
      );
    });

    it('leaves non-@nx/plugin imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/plugin';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { nxVersion } from '@nx/plugin/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/plugin/internal'`
    );
  });
});

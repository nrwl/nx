import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/module-federation-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/module-federation/internal', () => {
      const src = `import { getModuleFederationConfig } from '@nx/module-federation/src/some/internal';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { getModuleFederationConfig } from '@nx/module-federation/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/module-federation', () => {
      const src = `import { mapRemotes } from '@nx/module-federation/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { mapRemotes } from '@nx/module-federation';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { mapRemotes, getModuleFederationConfig } from '@nx/module-federation/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { mapRemotes } from '@nx/module-federation';\nimport { getModuleFederationConfig } from '@nx/module-federation/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { mapRemotes as aliased } from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { mapRemotes as aliased } from '@nx/module-federation';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { mapRemotes, getModuleFederationConfig } from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { mapRemotes } from '@nx/module-federation';\nimport type { getModuleFederationConfig } from '@nx/module-federation/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { mapRemotes, getModuleFederationConfig } from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { mapRemotes } from '@nx/module-federation';\nexport { getModuleFederationConfig } from '@nx/module-federation/internal';\n`
      );
    });

    it('routes a namespace import to @nx/module-federation/internal', () => {
      const src = `import * as ns from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/module-federation/internal';\n`
      );
    });

    it('routes a default import to @nx/module-federation/internal', () => {
      const src = `import thing from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/module-federation/internal';\n`
      );
    });

    it('routes export * to @nx/module-federation/internal', () => {
      const src = `export * from '@nx/module-federation/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/module-federation/internal';\n`
      );
    });

    it('routes require() to @nx/module-federation/internal', () => {
      const src = `const m = require('@nx/module-federation/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/module-federation/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/module-federation/internal', () => {
      const src = `const m = await import('@nx/module-federation/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/module-federation/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/module-federation/internal', () => {
      const src = `let m: typeof import('@nx/module-federation/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/module-federation/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/module-federation/src/x') as typeof import('@nx/module-federation/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/module-federation/internal') as typeof import('@nx/module-federation/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/module-federation/internal', () => {
      const src = `jest.mock('@nx/module-federation/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/module-federation/internal');\n`
      );
    });

    it('leaves non-@nx/module-federation imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/module-federation';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { getModuleFederationConfig } from '@nx/module-federation/src/some/internal';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/module-federation/internal'`
    );
  });
});

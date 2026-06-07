import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/nuxt-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/nuxt/internal', () => {
      const src = `import { nxVersion } from '@nx/nuxt/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion } from '@nx/nuxt/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/nuxt', () => {
      const src = `import { nuxtInitGenerator } from '@nx/nuxt/src/generators/init/init';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nuxtInitGenerator } from '@nx/nuxt';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { nuxtInitGenerator, nxVersion } from '@nx/nuxt/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nuxtInitGenerator } from '@nx/nuxt';\nimport { nxVersion } from '@nx/nuxt/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { nuxtInitGenerator as aliased } from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nuxtInitGenerator as aliased } from '@nx/nuxt';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { InitSchema, nxVersion } from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { InitSchema } from '@nx/nuxt';\nimport type { nxVersion } from '@nx/nuxt/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { nuxtInitGenerator, nxVersion } from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { nuxtInitGenerator } from '@nx/nuxt';\nexport { nxVersion } from '@nx/nuxt/internal';\n`
      );
    });

    it('routes a namespace import to @nx/nuxt/internal', () => {
      const src = `import * as ns from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/nuxt/internal';\n`
      );
    });

    it('routes a default import to @nx/nuxt/internal', () => {
      const src = `import thing from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/nuxt/internal';\n`
      );
    });

    it('routes export * to @nx/nuxt/internal', () => {
      const src = `export * from '@nx/nuxt/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/nuxt/internal';\n`
      );
    });

    it('routes require() to @nx/nuxt/internal', () => {
      const src = `const m = require('@nx/nuxt/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/nuxt/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/nuxt/internal', () => {
      const src = `const m = await import('@nx/nuxt/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/nuxt/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/nuxt/internal', () => {
      const src = `let m: typeof import('@nx/nuxt/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/nuxt/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/nuxt/src/x') as typeof import('@nx/nuxt/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/nuxt/internal') as typeof import('@nx/nuxt/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/nuxt/internal', () => {
      const src = `jest.mock('@nx/nuxt/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/nuxt/internal');\n`
      );
    });

    it('leaves non-@nx/nuxt imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/nuxt';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { nxVersion } from '@nx/nuxt/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/nuxt/internal'`
    );
  });
});

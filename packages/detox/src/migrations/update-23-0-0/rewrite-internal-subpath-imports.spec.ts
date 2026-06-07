import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/detox-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/detox/internal', () => {
      const src = `import { detoxVersion } from '@nx/detox/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { detoxVersion } from '@nx/detox/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/detox', () => {
      const src = `import { detoxInitGenerator } from '@nx/detox/src/generators/init/init';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { detoxInitGenerator } from '@nx/detox';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { detoxInitGenerator, detoxVersion } from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { detoxInitGenerator } from '@nx/detox';\nimport { detoxVersion } from '@nx/detox/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { detoxInitGenerator as aliased } from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { detoxInitGenerator as aliased } from '@nx/detox';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { detoxInitGenerator, detoxVersion } from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { detoxInitGenerator } from '@nx/detox';\nimport type { detoxVersion } from '@nx/detox/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { detoxInitGenerator, detoxVersion } from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { detoxInitGenerator } from '@nx/detox';\nexport { detoxVersion } from '@nx/detox/internal';\n`
      );
    });

    it('routes a namespace import to @nx/detox/internal', () => {
      const src = `import * as ns from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/detox/internal';\n`
      );
    });

    it('routes a default import to @nx/detox/internal', () => {
      const src = `import thing from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/detox/internal';\n`
      );
    });

    it('routes export * to @nx/detox/internal', () => {
      const src = `export * from '@nx/detox/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/detox/internal';\n`
      );
    });

    it('routes require() to @nx/detox/internal', () => {
      const src = `const m = require('@nx/detox/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/detox/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/detox/internal', () => {
      const src = `const m = await import('@nx/detox/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/detox/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/detox/internal', () => {
      const src = `let m: typeof import('@nx/detox/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/detox/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/detox/src/x') as typeof import('@nx/detox/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/detox/internal') as typeof import('@nx/detox/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/detox/internal', () => {
      const src = `jest.mock('@nx/detox/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/detox/internal');\n`
      );
    });

    it('leaves non-@nx/detox imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/detox';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { detoxVersion } from '@nx/detox/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/detox/internal'`
    );
  });
});

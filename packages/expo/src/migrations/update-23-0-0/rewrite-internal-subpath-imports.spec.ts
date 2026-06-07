import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/expo-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/expo/internal', () => {
      const src = `import { nxVersion } from '@nx/expo/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { nxVersion } from '@nx/expo/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/expo', () => {
      const src = `import { expoApplicationGenerator } from '@nx/expo/src/generators/application/application';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { expoApplicationGenerator } from '@nx/expo';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { expoApplicationGenerator, nxVersion } from '@nx/expo/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { expoApplicationGenerator } from '@nx/expo';\nimport { nxVersion } from '@nx/expo/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { expoApplicationGenerator as aliased } from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { expoApplicationGenerator as aliased } from '@nx/expo';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { expoApplicationGenerator, nxVersion } from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { expoApplicationGenerator } from '@nx/expo';\nimport type { nxVersion } from '@nx/expo/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { expoApplicationGenerator, nxVersion } from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { expoApplicationGenerator } from '@nx/expo';\nexport { nxVersion } from '@nx/expo/internal';\n`
      );
    });

    it('routes a namespace import to @nx/expo/internal', () => {
      const src = `import * as ns from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/expo/internal';\n`
      );
    });

    it('routes a default import to @nx/expo/internal', () => {
      const src = `import thing from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/expo/internal';\n`
      );
    });

    it('routes export * to @nx/expo/internal', () => {
      const src = `export * from '@nx/expo/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/expo/internal';\n`
      );
    });

    it('routes require() to @nx/expo/internal', () => {
      const src = `const m = require('@nx/expo/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/expo/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/expo/internal', () => {
      const src = `const m = await import('@nx/expo/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/expo/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/expo/internal', () => {
      const src = `let m: typeof import('@nx/expo/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/expo/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/expo/src/x') as typeof import('@nx/expo/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/expo/internal') as typeof import('@nx/expo/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/expo/internal', () => {
      const src = `jest.mock('@nx/expo/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/expo/internal');\n`
      );
    });

    it('leaves non-@nx/expo imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/expo';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { nxVersion } from '@nx/expo/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/expo/internal'`
    );
  });
});

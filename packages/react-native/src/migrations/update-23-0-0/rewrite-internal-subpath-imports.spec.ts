import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/react-native-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/react-native/internal', () => {
      const src = `import { metroVersion } from '@nx/react-native/src/utils/versions';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { metroVersion } from '@nx/react-native/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/react-native', () => {
      const src = `import { reactNativeInitGenerator } from '@nx/react-native/src/generators/init/init';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactNativeInitGenerator } from '@nx/react-native';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const src = `import { reactNativeInitGenerator, metroVersion } from '@nx/react-native/src/some/path';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactNativeInitGenerator } from '@nx/react-native';\nimport { metroVersion } from '@nx/react-native/internal';\n`
      );
    });

    it('classifies aliased bindings by their original name', () => {
      const src = `import { reactNativeInitGenerator as aliased } from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { reactNativeInitGenerator as aliased } from '@nx/react-native';\n`
      );
    });

    it('preserves the type modifier when splitting', () => {
      const src = `import type { reactNativeInitGenerator, metroVersion } from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import type { reactNativeInitGenerator } from '@nx/react-native';\nimport type { metroVersion } from '@nx/react-native/internal';\n`
      );
    });

    it('routes export { ... } from by symbol', () => {
      const src = `export { reactNativeInitGenerator, metroVersion } from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export { reactNativeInitGenerator } from '@nx/react-native';\nexport { metroVersion } from '@nx/react-native/internal';\n`
      );
    });

    it('routes a namespace import to @nx/react-native/internal', () => {
      const src = `import * as ns from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/react-native/internal';\n`
      );
    });

    it('routes a default import to @nx/react-native/internal', () => {
      const src = `import thing from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import thing from '@nx/react-native/internal';\n`
      );
    });

    it('routes export * to @nx/react-native/internal', () => {
      const src = `export * from '@nx/react-native/src/x';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `export * from '@nx/react-native/internal';\n`
      );
    });

    it('routes require() to @nx/react-native/internal', () => {
      const src = `const m = require('@nx/react-native/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/react-native/internal');\n`
      );
    });

    it('routes dynamic import() to @nx/react-native/internal', () => {
      const src = `const m = await import('@nx/react-native/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/react-native/internal');\n`
      );
    });

    it('routes typeof import() type queries to @nx/react-native/internal', () => {
      const src = `let m: typeof import('@nx/react-native/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/react-native/internal');\n`
      );
    });

    it('rewrites both runtime and type args of a require()-with-cast', () => {
      const src = `const m = require('@nx/react-native/src/x') as typeof import('@nx/react-native/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = require('@nx/react-native/internal') as typeof import('@nx/react-native/internal');\n`
      );
    });

    it('routes jest.mock() to @nx/react-native/internal', () => {
      const src = `jest.mock('@nx/react-native/src/x');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/react-native/internal');\n`
      );
    });

    it('leaves non-@nx/react-native imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/react-native';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { metroVersion } from '@nx/react-native/src/utils/versions';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/react-native/internal'`
    );
  });
});

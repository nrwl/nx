import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteCompilationImport,
} from './move-typescript-compilation-import';

describe('move-typescript-compilation-import migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteCompilationImport (pure)', () => {
    it('rewrites a single-quoted import declaration', () => {
      const source = `import { compileTypeScript } from '@nx/workspace/src/utilities/typescript/compilation';\n`;
      expect(rewriteCompilationImport(source)).toBe(
        `import { compileTypeScript } from '@nx/js/src/utils/typescript/compilation';\n`
      );
    });

    it('rewrites a double-quoted type-only import', () => {
      const source = `import type { TypeScriptCompilationOptions } from "@nx/workspace/src/utilities/typescript/compilation";\n`;
      expect(rewriteCompilationImport(source)).toBe(
        `import type { TypeScriptCompilationOptions } from "@nx/js/src/utils/typescript/compilation";\n`
      );
    });

    it('rewrites a CommonJS require()', () => {
      const source = `const { compileTypeScript } = require('@nx/workspace/src/utilities/typescript/compilation');\n`;
      expect(rewriteCompilationImport(source)).toBe(
        `const { compileTypeScript } = require('@nx/js/src/utils/typescript/compilation');\n`
      );
    });

    it('rewrites a dynamic import()', () => {
      const source = `const mod = await import('@nx/workspace/src/utilities/typescript/compilation');\n`;
      expect(rewriteCompilationImport(source)).toBe(
        `const mod = await import('@nx/js/src/utils/typescript/compilation');\n`
      );
    });

    it('rewrites jest.mock() and jest.requireActual()', () => {
      const source = [
        `jest.mock('@nx/workspace/src/utilities/typescript/compilation');`,
        `const actual = jest.requireActual('@nx/workspace/src/utilities/typescript/compilation');`,
        ``,
      ].join('\n');
      expect(rewriteCompilationImport(source)).toBe(
        [
          `jest.mock('@nx/js/src/utils/typescript/compilation');`,
          `const actual = jest.requireActual('@nx/js/src/utils/typescript/compilation');`,
          ``,
        ].join('\n')
      );
    });

    it('leaves unrelated string literals alone', () => {
      const source = [
        `const docs = 'see @nx/workspace/src/utilities/typescript/compilation for details';`,
        `// import { foo } from '@nx/workspace/src/utilities/typescript/compilation';`,
        `import { joinPathFragments } from '@nx/devkit';`,
        ``,
      ].join('\n');
      expect(rewriteCompilationImport(source)).toBe(source);
    });

    it('leaves typeof import() type queries alone', () => {
      // The runtime `import('...')` form is a CallExpression; the type form
      // `typeof import('...')` is an ImportTypeNode and should not be touched.
      const source = `type X = typeof import('@nx/workspace/src/utilities/typescript/compilation');\n`;
      expect(rewriteCompilationImport(source)).toBe(source);
    });

    it('returns the source unchanged when there are no matches', () => {
      const source = `import { something } from '@nx/devkit';\n`;
      expect(rewriteCompilationImport(source)).toBe(source);
    });
  });

  describe('default export (Tree)', () => {
    it('rewrites imports across .ts files', async () => {
      tree.write(
        'apps/my-app/src/main.ts',
        `import { compileTypeScript } from '@nx/workspace/src/utilities/typescript/compilation';\n`
      );
      await update(tree);
      const updated = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(updated).toContain('@nx/js/src/utils/typescript/compilation');
      expect(updated).not.toContain(
        '@nx/workspace/src/utilities/typescript/compilation'
      );
    });

    it('does not touch non-TS files', async () => {
      const json = `{"path": "@nx/workspace/src/utilities/typescript/compilation"}`;
      tree.write('docs/example.json', json);
      await update(tree);
      // The migration must not have rewritten the path inside a JSON file.
      // (formatFiles may normalize whitespace, so we check the substring.)
      expect(tree.read('docs/example.json', 'utf-8')).toContain(
        '@nx/workspace/src/utilities/typescript/compilation'
      );
    });

    it('is a no-op for files that do not reference the old specifier', async () => {
      const original = `import { joinPathFragments } from '@nx/devkit';\n`;
      tree.write('apps/my-app/src/main.ts', original);
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toBe(original);
    });
  });
});

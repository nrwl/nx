import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-@nx/angular-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes a dropped utils import to @nx/angular/internal', () => {
      const src = `import { angularDevkitVersion } from '@nx/angular/src/utils';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { angularDevkitVersion } from '@nx/angular/internal';\n`
      );
    });

    it('routes a dropped move-impl require() to @nx/angular/internal', () => {
      const src = `const { move } = require('@nx/angular/src/generators/move/move-impl');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const { move } = require('@nx/angular/internal');\n`
      );
    });

    it('routes the dropped generators/utils subpath to @nx/angular/internal', () => {
      const src = `import { x } from '@nx/angular/src/generators/utils';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import { x } from '@nx/angular/internal';\n`
      );
    });

    it('LEAVES retained machinery subpaths (executors/builders/generators schema) untouched', () => {
      const src =
        `import { x } from '@nx/angular/src/executors/delegate-build/delegate-build.impl';\n` +
        `import s from '@nx/angular/src/builders/webpack-browser/schema.json';\n` +
        `import g from '@nx/angular/src/generators/application/schema.json';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });

    it('routes a namespace import of a dropped subpath to @nx/angular/internal', () => {
      const src = `import * as ns from '@nx/angular/src/utils';\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `import * as ns from '@nx/angular/internal';\n`
      );
    });

    it('routes dynamic import() of a dropped subpath to @nx/angular/internal', () => {
      const src = `const m = await import('@nx/angular/src/utils');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `const m = await import('@nx/angular/internal');\n`
      );
    });

    it('routes typeof import() of a dropped subpath to @nx/angular/internal', () => {
      const src = `let m: typeof import('@nx/angular/src/utils');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `let m: typeof import('@nx/angular/internal');\n`
      );
    });

    it('routes jest.mock() of a dropped subpath to @nx/angular/internal', () => {
      const src = `jest.mock('@nx/angular/src/utils');\n`;
      expect(rewriteSubpathImports(src)).toBe(
        `jest.mock('@nx/angular/internal');\n`
      );
    });

    it('leaves non-@nx/angular imports untouched', () => {
      const src = `import { foo } from '@nx/devkit';\nimport { bar } from '@nx/angular';\n`;
      expect(rewriteSubpathImports(src)).toBe(src);
    });
  });

  it('rewrites files across the tree and formats', async () => {
    tree.write(
      'libs/app/src/x.ts',
      `import { angularDevkitVersion } from '@nx/angular/src/utils';\n`
    );
    await update(tree);
    expect(tree.read('libs/app/src/x.ts', 'utf-8')).toContain(
      `from '@nx/angular/internal'`
    );
  });
});

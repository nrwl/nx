import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteSubpathImports,
} from './rewrite-internal-subpath-imports';

describe('rewrite-internal-subpath-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteSubpathImports (pure)', () => {
    it('routes an internal-symbol import to @nx/cypress/internal', () => {
      const source = `import { createExecutorContext } from '@nx/cypress/src/utils/ct-helpers';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { createExecutorContext } from '@nx/cypress/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/cypress', () => {
      const source = `import { configurationGenerator } from '@nx/cypress/src/generators/configuration/configuration';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { configurationGenerator } from '@nx/cypress';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const source = `import { configurationGenerator, createExecutorContext } from '@nx/cypress/src/utils/ct-helpers';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { configurationGenerator } from '@nx/cypress';`,
          `import { createExecutorContext } from '@nx/cypress/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('classifies aliased imports by their original name', () => {
      const source = `import { cypressInitGenerator as init, createExecutorContext as ctx } from '@nx/cypress/src/generators/init/init';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { cypressInitGenerator as init } from '@nx/cypress';`,
          `import { createExecutorContext as ctx } from '@nx/cypress/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('preserves a type-only modifier when splitting', () => {
      const source = `import type { CypressExecutorOptions } from '@nx/cypress/src/executors/cypress/cypress.impl';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import type { CypressExecutorOptions } from '@nx/cypress/internal';\n`
      );
    });

    it('rewrites a double-quoted import', () => {
      const source = `import { createExecutorContext } from "@nx/cypress/src/utils/ct-helpers";\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { createExecutorContext } from "@nx/cypress/internal";\n`
      );
    });

    it('routes a namespace import to @nx/cypress/internal', () => {
      const source = `import * as ctHelpers from '@nx/cypress/src/utils/ct-helpers';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import * as ctHelpers from '@nx/cypress/internal';\n`
      );
    });

    it('rewrites a public-symbol export-from to @nx/cypress', () => {
      const source = `export { migrateCypressProject } from '@nx/cypress/src/generators/migrate-to-cypress-11/migrate-to-cypress-11';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export { migrateCypressProject } from '@nx/cypress';\n`
      );
    });

    it('routes export * to @nx/cypress/internal', () => {
      const source = `export * from '@nx/cypress/src/utils/ct-helpers';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export * from '@nx/cypress/internal';\n`
      );
    });

    it('rewrites a CommonJS require() to the internal entry', () => {
      const source = `const { createExecutorContext } = require('@nx/cypress/src/utils/ct-helpers');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const { createExecutorContext } = require('@nx/cypress/internal');\n`
      );
    });

    it('rewrites a dynamic import() to the internal entry', () => {
      const source = `const mod = await import('@nx/cypress/src/utils/ct-helpers');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const mod = await import('@nx/cypress/internal');\n`
      );
    });

    it('rewrites a .js-extension subpath', () => {
      const source = `import { createExecutorContext } from '@nx/cypress/src/utils/ct-helpers.js';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { createExecutorContext } from '@nx/cypress/internal';\n`
      );
    });

    it('rewrites jest mock helpers to the internal entry', () => {
      const source = [
        `jest.doMock('@nx/cypress/src/utils/ct-helpers');`,
        `vi.importActual('@nx/cypress/src/executors/cypress/cypress.impl');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `jest.doMock('@nx/cypress/internal');`,
          `vi.importActual('@nx/cypress/internal');`,
          ``,
        ].join('\n')
      );
    });

    it('leaves the top-level @nx/cypress entry and @nx/cypress/plugin alone', () => {
      const source = [
        `import { configurationGenerator } from '@nx/cypress';`,
        `import { createNodesV2 } from '@nx/cypress/plugin';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves unrelated string literals and comments alone', () => {
      const source = [
        `const docs = 'see @nx/cypress/src/utils/ct-helpers for details';`,
        `// import { createExecutorContext } from '@nx/cypress/src/utils/ct-helpers';`,
        `import { joinPathFragments } from '@nx/devkit';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves typeof import() type queries alone', () => {
      const source = `type X = typeof import('@nx/cypress/src/utils/ct-helpers');\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('returns the source unchanged when there are no matches', () => {
      const source = `import { something } from '@nx/devkit';\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });
  });

  describe('default export (Tree)', () => {
    it('rewrites imports across .ts files', async () => {
      tree.write(
        'apps/my-app/src/main.ts',
        `import { createExecutorContext } from '@nx/cypress/src/utils/ct-helpers';\n`
      );
      await update(tree);
      const updated = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(updated).toContain('@nx/cypress/internal');
      expect(updated).not.toContain('@nx/cypress/src/utils/ct-helpers');
    });

    it('is a no-op for files that do not reference @nx/cypress/src/', async () => {
      const original = `import { joinPathFragments } from '@nx/devkit';\n`;
      tree.write('apps/my-app/src/main.ts', original);
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toBe(original);
    });
  });
});

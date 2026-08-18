import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  rewriteCreateNodesV2Imports,
} from './migrate-create-nodes-v2-to-create-nodes';

const SPECIFIERS = new Set(['@nx/vitest']);
const rewrite = (source: string) =>
  rewriteCreateNodesV2Imports(source, SPECIFIERS);

describe('migrate-create-nodes-v2-to-create-nodes migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteCreateNodesV2Imports', () => {
    it('renames a lone createNodesV2 named import', () => {
      const input = `import { createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n`
      );
    });

    it('preserves other named imports while renaming createNodesV2', () => {
      const input = `import { createNodesV2, SomeOtherExport } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes, SomeOtherExport } from '@nx/vitest';\n`
      );
    });

    it('rewrites the original name in `as` aliases', () => {
      const input = `import { createNodesV2 as cn } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes as cn } from '@nx/vitest';\n`
      );
    });

    it('collapses a redundant `createNodesV2 as createNodes` alias', () => {
      const input = `import { createNodesV2 as createNodes } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n`
      );
    });

    it('dedupes when both createNodes and createNodesV2 are imported', () => {
      const input = `import { createNodes, createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n`
      );
    });

    it('dedupes when createNodesV2 precedes createNodes', () => {
      const input = `import { createNodesV2, createNodes } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n`
      );
    });

    it('handles multi-line named imports', () => {
      const input = `import {\n  createNodes,\n  createNodesV2,\n  SomeOtherExport,\n} from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes, SomeOtherExport } from '@nx/vitest';\n`
      );
    });

    it('preserves a default import alongside the renamed binding', () => {
      const input = `import def, { createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import def, { createNodes } from '@nx/vitest';\n`
      );
    });

    it('handles `import type` declarations', () => {
      const input = `import type { createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import type { createNodes } from '@nx/vitest';\n`
      );
    });

    it('preserves inline `type` modifiers', () => {
      const input = `import { type createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `import { type createNodes } from '@nx/vitest';\n`
      );
    });

    it('rewrites named re-exports', () => {
      const input = `export { createNodesV2 } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `export { createNodes } from '@nx/vitest';\n`
      );
    });

    it('rewrites aliased named re-exports', () => {
      const input = `export { createNodesV2 as cn } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(
        `export { createNodes as cn } from '@nx/vitest';\n`
      );
    });

    it('does not touch createNodesV2 from a different specifier', () => {
      const input = `import { createNodesV2 } from '@nx/other-plugin/plugin';\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('does not touch createNodesV2 from a relative specifier', () => {
      const input = `import { createNodesV2 } from './plugin';\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('does not touch unrelated imports from the target specifier', () => {
      const input = `import { createNodes } from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('does not rewrite `export * from` declarations', () => {
      const input = `export * from '@nx/vitest';\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('leaves createNodesV2 in strings and comments alone', () => {
      const input =
        `// import { createNodesV2 } from '@nx/vitest';\n` +
        `const s = "createNodesV2";\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('does not rewrite require() destructuring (still valid via alias)', () => {
      const input = `const { createNodesV2 } = require('@nx/vitest');\n`;
      expect(rewrite(input)).toBe(input);
    });

    it('renames value usages of a lone createNodesV2 import', () => {
      const input =
        `import { createNodesV2 } from '@nx/vitest';\n` +
        `export const plugin = createNodesV2;\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n` +
          `export const plugin = createNodes;\n`
      );
    });

    it('renames a value usage passed as a call argument', () => {
      const input =
        `import { createNodesV2 } from '@nx/vitest';\n` +
        `addPlugin(graph, '@nx/vitest', createNodesV2, {});\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n` +
          `addPlugin(graph, '@nx/vitest', createNodes, {});\n`
      );
    });

    it('renames value usages when deduped against an existing createNodes', () => {
      const input =
        `import { createNodes, createNodesV2 } from '@nx/vitest';\n` +
        `use(createNodesV2);\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n` + `use(createNodes);\n`
      );
    });

    it('expands a shorthand property usage to preserve the key', () => {
      const input =
        `import { createNodesV2 } from '@nx/vitest';\n` +
        `export const plugins = { createNodesV2 };\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n` +
          `export const plugins = { createNodesV2: createNodes };\n`
      );
    });

    it('leaves property accesses and strings while renaming the binding', () => {
      const input =
        `import { createNodesV2 } from '@nx/vitest';\n` +
        `const v = createNodesV2;\n` +
        `const w = config.createNodesV2;\n` +
        `const s = 'createNodesV2';\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes } from '@nx/vitest';\n` +
          `const v = createNodes;\n` +
          `const w = config.createNodesV2;\n` +
          `const s = 'createNodesV2';\n`
      );
    });

    it('does not rename usages for an aliased import (local name preserved)', () => {
      const input =
        `import { createNodesV2 as cn } from '@nx/vitest';\n` +
        `export const plugin = cn;\n`;
      expect(rewrite(input)).toBe(
        `import { createNodes as cn } from '@nx/vitest';\n` +
          `export const plugin = cn;\n`
      );
    });
  });

  describe('migration runner', () => {
    it('rewrites imports across .ts/.tsx/.cts/.mts files', async () => {
      tree.write(
        'libs/foo/src/a.ts',
        `import { createNodesV2 } from '@nx/vitest';\n`
      );
      tree.write(
        'libs/foo/src/b.tsx',
        `import { createNodesV2 as cn } from '@nx/vitest';\n`
      );
      tree.write(
        'libs/foo/src/c.cts',
        `export { createNodesV2 } from '@nx/vitest';\n`
      );
      tree.write(
        'libs/foo/src/d.mts',
        `import { createNodesV2, SomeOtherExport } from '@nx/vitest';\n`
      );

      await migration(tree);

      expect(tree.read('libs/foo/src/a.ts', 'utf-8')).toContain(
        `import { createNodes } from '@nx/vitest';`
      );
      expect(tree.read('libs/foo/src/b.tsx', 'utf-8')).toContain(
        `import { createNodes as cn } from '@nx/vitest';`
      );
      expect(tree.read('libs/foo/src/c.cts', 'utf-8')).toContain(
        `export { createNodes } from '@nx/vitest';`
      );
      expect(tree.read('libs/foo/src/d.mts', 'utf-8')).toContain(
        `import { createNodes, SomeOtherExport } from '@nx/vitest';`
      );
    });

    it('does not touch files without the deprecated name', async () => {
      const content = `import { createNodes } from '@nx/vitest';\n`;
      tree.write('libs/foo/src/index.ts', content);

      await migration(tree);

      expect(tree.read('libs/foo/src/index.ts', 'utf-8')).toBe(content);
    });

    it('does not rewrite non-TS files', async () => {
      const md = `Example: \`import { createNodesV2 } from '@nx/vitest';\`\n`;
      tree.write('docs/example.md', md);

      await migration(tree);

      expect(tree.read('docs/example.md', 'utf-8')).toContain(
        `import { createNodesV2 } from '@nx/vitest';`
      );
    });
  });
});

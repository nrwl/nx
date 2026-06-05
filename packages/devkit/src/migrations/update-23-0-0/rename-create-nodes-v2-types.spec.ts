import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  CREATE_NODES_V2_TYPE_RENAMES,
  rewriteCreateNodesV2Types,
} from './rename-create-nodes-v2-types';

describe('rename-create-nodes-v2-types migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteCreateNodesV2Types', () => {
    it('renames each deprecated type to its canonical name', () => {
      for (const [from, to] of CREATE_NODES_V2_TYPE_RENAMES) {
        const input = `import type { ${from} } from '@nx/devkit';\n`;
        expect(rewriteCreateNodesV2Types(input)).toBe(
          `import type { ${to} } from '@nx/devkit';\n`
        );
      }
    });

    it('renames value-position imports too', () => {
      const input = `import { NxPluginV2 } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import { NxPlugin } from '@nx/devkit';\n`
      );
    });

    it('renames CreateNodesResultV2 to CreateNodesResultArray', () => {
      const input = `import type { CreateNodesResultV2 } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { CreateNodesResultArray } from '@nx/devkit';\n`
      );
    });

    it('leaves the unrelated CreateNodesResult type alone', () => {
      const input = `import type { CreateNodesResult } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(input);
    });

    it('renames several types in one import and preserves others', () => {
      const input = `import type { CreateNodesV2, CreateNodesContextV2, Tree } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { CreateNodes, CreateNodesContext, Tree } from '@nx/devkit';\n`
      );
    });

    it('preserves `as` aliases', () => {
      const input = `import type { CreateNodesV2 as CN } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { CreateNodes as CN } from '@nx/devkit';\n`
      );
    });

    it('collapses a redundant `CreateNodesV2 as CreateNodes` alias', () => {
      const input = `import type { CreateNodesV2 as CreateNodes } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { CreateNodes } from '@nx/devkit';\n`
      );
    });

    it('dedupes when both the V2 and canonical names are imported', () => {
      const input = `import type { CreateNodes, CreateNodesV2 } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { CreateNodes } from '@nx/devkit';\n`
      );
    });

    it('handles inline `type` modifiers in a value import', () => {
      const input = `import { type NxPluginV2, readJson } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import { type NxPlugin, readJson } from '@nx/devkit';\n`
      );
    });

    it('handles multi-line imports', () => {
      const input = `import type {\n  NxPluginV2,\n  CreateNodesFunctionV2,\n} from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `import type { NxPlugin, CreateNodesFunction } from '@nx/devkit';\n`
      );
    });

    it('rewrites named re-exports', () => {
      const input = `export type { CreateNodesV2 } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(
        `export type { CreateNodes } from '@nx/devkit';\n`
      );
    });

    it('does not touch the types when imported from another specifier', () => {
      const input = `import type { CreateNodesV2 } from '@nx/devkit/internal';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(input);
    });

    it('does not touch unrelated @nx/devkit imports', () => {
      const input = `import { Tree, readJson } from '@nx/devkit';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(input);
    });

    it('leaves the V2 names in strings and comments alone', () => {
      const input =
        `// import { CreateNodesV2 } from '@nx/devkit';\n` +
        `const s = 'CreateNodesV2';\n`;
      expect(rewriteCreateNodesV2Types(input)).toBe(input);
    });
  });

  describe('migration runner', () => {
    it('rewrites type imports across .ts/.tsx/.cts/.mts files', async () => {
      tree.write(
        'libs/foo/src/a.ts',
        `import type { CreateNodesV2 } from '@nx/devkit';\n`
      );
      tree.write(
        'libs/foo/src/b.tsx',
        `import { NxPluginV2 } from '@nx/devkit';\n`
      );
      tree.write(
        'libs/foo/src/c.cts',
        `export type { CreateNodesContextV2 } from '@nx/devkit';\n`
      );
      tree.write(
        'libs/foo/src/d.mts',
        `import type { CreateNodesResultV2 } from '@nx/devkit';\n`
      );

      await migration(tree);

      expect(tree.read('libs/foo/src/a.ts', 'utf-8')).toContain(
        `import type { CreateNodes } from '@nx/devkit';`
      );
      expect(tree.read('libs/foo/src/b.tsx', 'utf-8')).toContain(
        `import { NxPlugin } from '@nx/devkit';`
      );
      expect(tree.read('libs/foo/src/c.cts', 'utf-8')).toContain(
        `export type { CreateNodesContext } from '@nx/devkit';`
      );
      expect(tree.read('libs/foo/src/d.mts', 'utf-8')).toContain(
        `import type { CreateNodesResultArray } from '@nx/devkit';`
      );
    });

    it('does not rewrite non-TS files', async () => {
      const md = `Example: \`import type { CreateNodesV2 } from '@nx/devkit';\`\n`;
      tree.write('docs/example.md', md);

      await migration(tree);

      expect(tree.read('docs/example.md', 'utf-8')).toContain(
        `import type { CreateNodesV2 } from '@nx/devkit';`
      );
    });
  });
});

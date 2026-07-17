import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  DEVKIT_INTERNAL_SYMBOLS,
  rewriteDevkitDeepImports,
} from './update-deep-imports';

describe('update-deep-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteDevkitDeepImports', () => {
    it('routes a single internal symbol to @nx/devkit/internal', () => {
      const input = `import { dasherize } from '@nx/devkit/src/utils/string-utils';\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `import { dasherize } from '@nx/devkit/internal';\n`
      );
    });

    it('routes a single public symbol to @nx/devkit', () => {
      const input = `import { names } from '@nx/devkit/src/utils/names';\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `import { names } from '@nx/devkit';\n`
      );
    });

    it('splits mixed public and internal symbols across two declarations', () => {
      const input = `import { dasherize, names } from '@nx/devkit/src/utils/string-utils';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { names } from '@nx/devkit';`);
      expect(output).toContain(
        `import { dasherize } from '@nx/devkit/internal';`
      );
    });

    it('preserves `as` aliases', () => {
      const input = `import { dasherize as toKebab } from '@nx/devkit/src/utils/string-utils';\n`;
      expect(rewriteDevkitDeepImports(input)).toContain(
        `import { dasherize as toKebab } from '@nx/devkit/internal';`
      );
    });

    it('handles `import type` declarations', () => {
      const input = `import type { FileExtensionType } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';\n`;
      expect(rewriteDevkitDeepImports(input)).toContain(
        `import type { FileExtensionType } from '@nx/devkit/internal';`
      );
    });

    it('preserves inline `type` modifiers on individual specifiers', () => {
      const input = `import { type FileExtensionType, addPlugin } from '@nx/devkit/src/x';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import { type FileExtensionType, addPlugin } from '@nx/devkit/internal';`
      );
    });

    it('drops redundant inline `type` when the whole import is already type-only', () => {
      const input = `import type { type FileExtensionType } from '@nx/devkit/src/x';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import type { FileExtensionType } from '@nx/devkit/internal';`
      );
    });

    it('handles multi-line named imports', () => {
      const input = `import {\n  dasherize,\n  names,\n  classify,\n} from '@nx/devkit/src/utils/string-utils';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { names } from '@nx/devkit';`);
      expect(output).toContain(
        `import { dasherize, classify } from '@nx/devkit/internal';`
      );
    });

    it('rewrites multiple deep imports in one file', () => {
      const input =
        `import { dasherize } from '@nx/devkit/src/utils/string-utils';\n` +
        `import { names } from '@nx/devkit/src/utils/names';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import { dasherize } from '@nx/devkit/internal';`
      );
      expect(output).toContain(`import { names } from '@nx/devkit';`);
    });

    it('falls back to /internal for side-effect imports', () => {
      const input = `import '@nx/devkit/src/utils/some-side-effect';\n`;
      expect(rewriteDevkitDeepImports(input)).toContain(
        `import '@nx/devkit/internal';`
      );
    });

    it('falls back to /internal for default imports', () => {
      const input = `import x from '@nx/devkit/src/utils/foo';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`'@nx/devkit/internal'`);
      expect(output).toContain(`import x from`);
    });

    it('falls back to /internal for namespace imports', () => {
      const input = `import * as devkit from '@nx/devkit/src/utils/foo';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import * as devkit from '@nx/devkit/internal';`
      );
    });

    it('falls back to /internal for require()', () => {
      const input = `const x = require('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `const x = require('@nx/devkit/internal');\n`
      );
    });

    it('falls back to /internal for dynamic import()', () => {
      const input = `const x = await import('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `const x = await import('@nx/devkit/internal');\n`
      );
    });

    it('preserves quote style on fallback paths', () => {
      const input = `const x = require("@nx/devkit/src/utils/foo");\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `const x = require("@nx/devkit/internal");\n`
      );
    });

    it('does not touch unrelated @nx/devkit imports', () => {
      const input = `import { Tree } from '@nx/devkit';\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('does not touch unrelated @nx/devkit/internal imports', () => {
      const input = `import { dasherize } from '@nx/devkit/internal';\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });
  });

  // These tests guard against an earlier implementation that string-replaced
  // every `'@nx/devkit/src/...'` literal in the file. That over-eager rewrite
  // mangled test fixtures inside template literals, type queries, comments,
  // and other non-runtime usages. The current AST-based pass must leave them
  // alone.
  describe('non-runtime string literals', () => {
    it('does not rewrite deep-import paths inside template literals', () => {
      const input = `const fixture = \`import { dasherize } from '@nx/devkit/src/utils/string-utils';\\n\`;\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('does not rewrite deep-import paths inside `typeof import(...)` type queries', () => {
      const input = `type Devkit = typeof import('@nx/devkit/src/executors/parse-target-string');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('does not rewrite deep-import paths inside block comments', () => {
      const input = `/* see @nx/devkit/src/utils/foo */\nconst x = 1;\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('does not rewrite deep-import paths inside line comments', () => {
      const input = `// see '@nx/devkit/src/utils/foo'\nconst x = 1;\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('does not rewrite arbitrary string-literal arguments to unrelated calls', () => {
      const input = `someUnrelatedFn('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });
  });

  describe('mock helper calls', () => {
    it('rewrites jest.mock(...) targets', () => {
      const input = `jest.mock('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `jest.mock('@nx/devkit/internal');\n`
      );
    });

    it('rewrites jest.requireActual(...) targets', () => {
      const input = `const real = jest.requireActual('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `const real = jest.requireActual('@nx/devkit/internal');\n`
      );
    });

    it('rewrites vi.mock(...) targets', () => {
      const input = `vi.mock('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `vi.mock('@nx/devkit/internal');\n`
      );
    });

    it('rewrites vi.importActual(...) targets', () => {
      const input = `const real = await vi.importActual('@nx/devkit/src/utils/foo');\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(
        `const real = await vi.importActual('@nx/devkit/internal');\n`
      );
    });

    it('rewrites paired import + jest.mock together', () => {
      const input =
        `import * as cfg from '@nx/devkit/src/utils/config-utils';\n` +
        `jest.mock('@nx/devkit/src/utils/config-utils', () => ({\n` +
        `  ...jest.requireActual('@nx/devkit/src/utils/config-utils'),\n` +
        `}));\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import * as cfg from '@nx/devkit/internal';`);
      expect(output).toContain(`jest.mock('@nx/devkit/internal',`);
      expect(output).toContain(`jest.requireActual('@nx/devkit/internal')`);
    });
  });

  describe('migration runner', () => {
    it('rewrites deep imports across .ts/.tsx/.cts/.mts files', async () => {
      tree.write(
        'libs/foo/src/a.ts',
        `import { dasherize } from '@nx/devkit/src/utils/string-utils';\n`
      );
      tree.write(
        'libs/foo/src/b.tsx',
        `import { addPlugin } from '@nx/devkit/src/utils/add-plugin';\n`
      );
      tree.write(
        'libs/foo/src/c.cts',
        `const { classify } = require('@nx/devkit/src/utils/string-utils');\n`
      );
      tree.write(
        'libs/foo/src/d.mts',
        `import { camelize } from '@nx/devkit/src/utils/string-utils';\n`
      );

      await migration(tree);

      expect(tree.read('libs/foo/src/a.ts', 'utf-8')).toContain(
        `'@nx/devkit/internal'`
      );
      expect(tree.read('libs/foo/src/b.tsx', 'utf-8')).toContain(
        `'@nx/devkit/internal'`
      );
      expect(tree.read('libs/foo/src/c.cts', 'utf-8')).toContain(
        `'@nx/devkit/internal'`
      );
      expect(tree.read('libs/foo/src/d.mts', 'utf-8')).toContain(
        `'@nx/devkit/internal'`
      );
    });

    it('does not rewrite deep-import strings inside non-TS files', async () => {
      const md = `Example: \`import { x } from '@nx/devkit/src/utils/foo';\`\n`;
      tree.write('docs/example.md', md);

      await migration(tree);

      // The deep-import literal must survive untouched in markdown — only TS
      // sources should be rewritten. (formatFiles may normalize trailing
      // whitespace, so we assert on substring rather than full equality.)
      expect(tree.read('docs/example.md', 'utf-8')).toContain(
        `'@nx/devkit/src/utils/foo'`
      );
    });

    it('does not touch files that do not contain the deep prefix', async () => {
      const content = `import { Tree } from '@nx/devkit';\n`;
      tree.write('libs/foo/src/index.ts', content);

      await migration(tree);

      expect(tree.read('libs/foo/src/index.ts', 'utf-8')).toBe(content);
    });
  });

  describe('collapse', () => {
    it('merges a rewritten import into a pre-existing @nx/devkit import', () => {
      const input =
        `import { Tree } from '@nx/devkit';\n` +
        `import { names } from '@nx/devkit/src/utils/names';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { Tree, names } from '@nx/devkit';`);
      expect(output).not.toMatch(
        /import \{[^}]*\} from '@nx\/devkit';[\s\S]*import \{[^}]*\} from '@nx\/devkit';/
      );
    });

    it('merges a rewritten import into a pre-existing @nx/devkit/internal import', () => {
      const input =
        `import { dasherize } from '@nx/devkit/internal';\n` +
        `import { classify } from '@nx/devkit/src/utils/string-utils';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import { dasherize, classify } from '@nx/devkit/internal';`
      );
    });

    it('merges multiple rewritten imports that target the same specifier', () => {
      const input =
        `import { dasherize } from '@nx/devkit/src/utils/string-utils';\n` +
        `import { classify } from '@nx/devkit/src/utils/string-utils';\n` +
        `import { camelize } from '@nx/devkit/src/utils/string-utils';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(
        `import { dasherize, classify, camelize } from '@nx/devkit/internal';`
      );
      // Only one /internal declaration in the output.
      expect((output.match(/from '@nx\/devkit\/internal'/g) ?? []).length).toBe(
        1
      );
    });

    it('keeps public and internal collapses independent', () => {
      const input =
        `import { Tree } from '@nx/devkit';\n` +
        `import { dasherize, names } from '@nx/devkit/src/utils/string-utils';\n` +
        `import { classify } from '@nx/devkit/src/utils/string-utils';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { Tree, names } from '@nx/devkit';`);
      expect(output).toContain(
        `import { dasherize, classify } from '@nx/devkit/internal';`
      );
    });

    it('does not merge value imports with type-only imports', () => {
      const input =
        `import type { Tree } from '@nx/devkit';\n` +
        `import { names } from '@nx/devkit/src/utils/names';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import type { Tree } from '@nx/devkit';`);
      expect(output).toContain(`import { names } from '@nx/devkit';`);
    });

    it('merges duplicate specifiers without repeating them', () => {
      const input =
        `import { Tree } from '@nx/devkit';\n` +
        `import { Tree, names } from '@nx/devkit';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { Tree, names } from '@nx/devkit';`);
      expect((output.match(/Tree/g) ?? []).length).toBe(1);
    });

    it('does not touch a file that already has a single canonical import', () => {
      const input = `import { Tree, names } from '@nx/devkit';\n`;
      expect(rewriteDevkitDeepImports(input)).toBe(input);
    });

    it('leaves unrelated imports between merged declarations alone', () => {
      const input =
        `import { Tree } from '@nx/devkit';\n` +
        `import { readFileSync } from 'node:fs';\n` +
        `import { names } from '@nx/devkit/src/utils/names';\n`;
      const output = rewriteDevkitDeepImports(input);
      expect(output).toContain(`import { Tree, names } from '@nx/devkit';`);
      expect(output).toContain(`import { readFileSync } from 'node:fs';`);
    });
  });

  describe('symbol set sanity', () => {
    it('treats every name in DEVKIT_INTERNAL_SYMBOLS as internal', () => {
      for (const name of DEVKIT_INTERNAL_SYMBOLS) {
        const input = `import { ${name} } from '@nx/devkit/src/x';\n`;
        const output = rewriteDevkitDeepImports(input);
        expect(output).toContain(
          `import { ${name} } from '@nx/devkit/internal';`
        );
      }
    });
  });
});

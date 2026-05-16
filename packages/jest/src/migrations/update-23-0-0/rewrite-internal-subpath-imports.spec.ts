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
    it('rewrites a single-quoted import declaration', () => {
      const source = `import { versions } from '@nx/jest/src/utils/versions';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { versions } from '@nx/jest/internal';\n`
      );
    });

    it('rewrites a double-quoted type-only import', () => {
      const source = `import type { JestConfigExtension } from "@nx/jest/src/utils/config/config-file";\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import type { JestConfigExtension } from "@nx/jest/internal";\n`
      );
    });

    it('rewrites a deep subpath import', () => {
      const source = `import { findRootJestPreset } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { findRootJestPreset } from '@nx/jest/internal';\n`
      );
    });

    it('rewrites a CommonJS require()', () => {
      const source = `const { versions } = require('@nx/jest/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const { versions } = require('@nx/jest/internal');\n`
      );
    });

    it('rewrites a dynamic import()', () => {
      const source = `const mod = await import('@nx/jest/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const mod = await import('@nx/jest/internal');\n`
      );
    });

    it('rewrites a .js-extension subpath', () => {
      const source = `import { versions } from '@nx/jest/src/utils/versions.js';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { versions } from '@nx/jest/internal';\n`
      );
    });

    it('rewrites jest.mock() and jest.requireActual()', () => {
      const source = [
        `jest.mock('@nx/jest/src/utils/versions', () => ({`,
        `  ...jest.requireActual('@nx/jest/src/utils/versions'),`,
        `  getInstalledJestMajorVersion: jest.fn(() => 30),`,
        `}));`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `jest.mock('@nx/jest/internal', () => ({`,
          `  ...jest.requireActual('@nx/jest/internal'),`,
          `  getInstalledJestMajorVersion: jest.fn(() => 30),`,
          `}));`,
          ``,
        ].join('\n')
      );
    });

    it('rewrites vi.mock() variants', () => {
      const source = `vi.mock('@nx/jest/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `vi.mock('@nx/jest/internal');\n`
      );
    });

    it('leaves the top-level @nx/jest entry alone', () => {
      const source = `import { findJestConfig } from '@nx/jest';\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves @nx/jest/preset and @nx/jest/plugin alone', () => {
      const source = [
        `import { nxPreset } from '@nx/jest/preset';`,
        `import { createNodesV2 } from '@nx/jest/plugin';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves unrelated string literals alone', () => {
      const source = [
        `const docs = 'see @nx/jest/src/utils/versions for details';`,
        `// import { versions } from '@nx/jest/src/utils/versions';`,
        `import { joinPathFragments } from '@nx/devkit';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves typeof import() type queries alone', () => {
      const source = `type X = typeof import('@nx/jest/src/utils/versions');\n`;
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
        `import { versions } from '@nx/jest/src/utils/versions';\n`
      );
      await update(tree);
      const updated = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(updated).toContain('@nx/jest/internal');
      expect(updated).not.toContain('@nx/jest/src/utils/versions');
    });

    it('does not touch non-TS files', async () => {
      const json = `{"path": "@nx/jest/src/utils/versions"}`;
      tree.write('docs/example.json', json);
      await update(tree);
      expect(tree.read('docs/example.json', 'utf-8')).toContain(
        '@nx/jest/src/utils/versions'
      );
    });

    it('is a no-op for files that do not reference @nx/jest/src/', async () => {
      const original = `import { joinPathFragments } from '@nx/devkit';\n`;
      tree.write('apps/my-app/src/main.ts', original);
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toBe(original);
    });
  });
});

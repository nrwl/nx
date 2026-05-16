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
    it('routes an internal-symbol import to @nx/jest/internal', () => {
      const source = `import { versions } from '@nx/jest/src/utils/versions';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { versions } from '@nx/jest/internal';\n`
      );
    });

    it('routes a public-symbol import to @nx/jest', () => {
      const source = `import { findJestConfig } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { findJestConfig } from '@nx/jest';\n`
      );
    });

    it('splits a mixed public/internal import into two declarations', () => {
      const source = `import { findJestConfig, findRootJestPreset } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { findJestConfig } from '@nx/jest';`,
          `import { findRootJestPreset } from '@nx/jest/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('classifies aliased imports by their original name', () => {
      const source = `import { findJestConfig as fjc, findRootJestPreset as frp } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { findJestConfig as fjc } from '@nx/jest';`,
          `import { findRootJestPreset as frp } from '@nx/jest/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('preserves a type-only modifier when splitting', () => {
      const source = `import type { findJestConfig, JestConfigExtension } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import type { findJestConfig } from '@nx/jest';`,
          `import type { JestConfigExtension } from '@nx/jest/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('rewrites a double-quoted type-only import', () => {
      const source = `import type { JestConfigExtension } from "@nx/jest/src/utils/config/config-file";\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import type { JestConfigExtension } from "@nx/jest/internal";\n`
      );
    });

    it('routes a namespace import to @nx/jest/internal', () => {
      const source = `import * as versions from '@nx/jest/src/utils/versions';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import * as versions from '@nx/jest/internal';\n`
      );
    });

    it('rewrites a public-symbol export-from to @nx/jest', () => {
      const source = `export { findJestConfig } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export { findJestConfig } from '@nx/jest';\n`
      );
    });

    it('splits a mixed export-from declaration', () => {
      const source = `export { findJestConfig, findRootJestPreset } from '@nx/jest/src/utils/config/config-file';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        [
          `export { findJestConfig } from '@nx/jest';`,
          `export { findRootJestPreset } from '@nx/jest/internal';`,
          ``,
        ].join('\n')
      );
    });

    it('routes export * to @nx/jest/internal', () => {
      const source = `export * from '@nx/jest/src/utils/versions';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `export * from '@nx/jest/internal';\n`
      );
    });

    it('rewrites a CommonJS require() to the internal entry', () => {
      const source = `const { versions } = require('@nx/jest/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const { versions } = require('@nx/jest/internal');\n`
      );
    });

    it('rewrites a dynamic import() to the internal entry', () => {
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

    it('rewrites jest.mock() and jest.requireActual() to the internal entry', () => {
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

    it('rewrites the other mock helper methods (doMock, importActual)', () => {
      const source = [
        `jest.doMock('@nx/jest/src/utils/versions');`,
        `vi.importActual('@nx/jest/src/utils/config/config-file');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `jest.doMock('@nx/jest/internal');`,
          `vi.importActual('@nx/jest/internal');`,
          ``,
        ].join('\n')
      );
    });

    it('rewrites every specifier when an import and a jest.mock appear in the same file', () => {
      const source = [
        `import { versions } from '@nx/jest/src/utils/versions';`,
        `import { something } from '@nx/devkit';`,
        ``,
        `jest.mock('@nx/jest/src/utils/config/config-file');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `import { versions } from '@nx/jest/internal';`,
          `import { something } from '@nx/devkit';`,
          ``,
          `jest.mock('@nx/jest/internal');`,
          ``,
        ].join('\n')
      );
    });

    it('leaves non-mock jest.* calls alone', () => {
      const source = `jest.setTimeout('@nx/jest/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
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

    it('routes public symbols to @nx/jest across files', async () => {
      tree.write(
        'apps/my-app/src/main.ts',
        `import { findJestConfig } from '@nx/jest/src/utils/config/config-file';\n`
      );
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toContain(
        `from '@nx/jest'`
      );
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

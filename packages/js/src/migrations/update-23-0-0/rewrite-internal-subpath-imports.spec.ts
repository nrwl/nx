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
      const source = `import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { ensureTypescript } from '@nx/js/internal';\n`
      );
    });

    it('rewrites a double-quoted type-only import', () => {
      const source = `import type { TypeScriptCompilationOptions } from "@nx/js/src/utils/typescript/compilation";\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import type { TypeScriptCompilationOptions } from "@nx/js/internal";\n`
      );
    });

    it('rewrites a deep subpath import', () => {
      const source = `import { addReleaseConfigForTsSolution } from '@nx/js/src/generators/library/utils/add-release-config';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { addReleaseConfigForTsSolution } from '@nx/js/internal';\n`
      );
    });

    it('rewrites a CommonJS require()', () => {
      const source = `const { compileTypeScript } = require('@nx/js/src/utils/typescript/compilation');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const { compileTypeScript } = require('@nx/js/internal');\n`
      );
    });

    it('rewrites a dynamic import()', () => {
      const source = `const mod = await import('@nx/js/src/utils/typescript/compilation');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `const mod = await import('@nx/js/internal');\n`
      );
    });

    it('rewrites a .js-extension subpath', () => {
      const source = `import { calculateProjectDependencies } from '@nx/js/src/utils/buildable-libs-utils.js';\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `import { calculateProjectDependencies } from '@nx/js/internal';\n`
      );
    });

    it('rewrites jest.mock() and jest.requireActual()', () => {
      const source = [
        `jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({`,
        `  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),`,
        `  isUsingTsSolutionSetup: jest.fn(() => false),`,
        `}));`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(
        [
          `jest.mock('@nx/js/internal', () => ({`,
          `  ...jest.requireActual('@nx/js/internal'),`,
          `  isUsingTsSolutionSetup: jest.fn(() => false),`,
          `}));`,
          ``,
        ].join('\n')
      );
    });

    it('rewrites vi.mock() variants', () => {
      const source = `vi.mock('@nx/js/src/utils/versions');\n`;
      expect(rewriteSubpathImports(source)).toBe(
        `vi.mock('@nx/js/internal');\n`
      );
    });

    it('preserves @nx/js/src/release/version-actions imports', () => {
      const source = [
        `import * as versionActions from '@nx/js/src/release/version-actions';`,
        `const va = require('@nx/js/src/release/version-actions');`,
        `jest.mock('@nx/js/src/release/version-actions');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('preserves @nx/js/src/utils/assets/copy-assets-handler imports', () => {
      const source = [
        `import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';`,
        `const h = require('@nx/js/src/utils/assets/copy-assets-handler');`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves the top-level @nx/js entry alone', () => {
      const source = `import { readTsConfig } from '@nx/js';\n`;
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves @nx/js/babel and @nx/js/typescript alone', () => {
      const source = [
        `import { babelPreset } from '@nx/js/babel';`,
        `import { typescriptUtil } from '@nx/js/typescript';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves unrelated string literals alone', () => {
      const source = [
        `const docs = 'see @nx/js/src/utils/typescript/ts-config for details';`,
        `// import { foo } from '@nx/js/src/utils/typescript/ts-config';`,
        `import { joinPathFragments } from '@nx/devkit';`,
        ``,
      ].join('\n');
      expect(rewriteSubpathImports(source)).toBe(source);
    });

    it('leaves typeof import() type queries alone', () => {
      const source = `type X = typeof import('@nx/js/src/utils/typescript/ts-config');\n`;
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
        `import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';\n`
      );
      await update(tree);
      const updated = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(updated).toContain('@nx/js/internal');
      expect(updated).not.toContain(
        '@nx/js/src/utils/typescript/ensure-typescript'
      );
    });

    it('does not touch non-TS files', async () => {
      const json = `{"path": "@nx/js/src/utils/typescript/ensure-typescript"}`;
      tree.write('docs/example.json', json);
      await update(tree);
      expect(tree.read('docs/example.json', 'utf-8')).toContain(
        '@nx/js/src/utils/typescript/ensure-typescript'
      );
    });

    it('is a no-op for files that do not reference @nx/js/src/', async () => {
      const original = `import { joinPathFragments } from '@nx/devkit';\n`;
      tree.write('apps/my-app/src/main.ts', original);
      await update(tree);
      expect(tree.read('apps/my-app/src/main.ts', 'utf-8')).toBe(original);
    });

    it('preserves release/version-actions imports across files', async () => {
      const original = `import * as va from '@nx/js/src/release/version-actions';\n`;
      tree.write('libs/release/src/index.ts', original);
      await update(tree);
      expect(tree.read('libs/release/src/index.ts', 'utf-8')).toBe(original);
    });
  });
});

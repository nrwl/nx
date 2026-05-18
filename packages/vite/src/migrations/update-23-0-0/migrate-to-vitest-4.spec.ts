import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateToVitest4 from './migrate-to-vitest-4';

describe('migrate-to-vitest-4', () => {
  describe('coverage option removals (V4-1)', () => {
    it('removes `all`, `extensions`, `ignoreEmptyLines`, `experimentalAstAwareRemapping` inside test.coverage', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      extensions: ['.ts', '.tsx'],
      ignoreEmptyLines: false,
      experimentalAstAwareRemapping: true,
      reporter: ['text'],
    },
  },
});
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).not.toContain('all:');
      expect(updated).not.toContain('extensions:');
      expect(updated).not.toContain('ignoreEmptyLines:');
      expect(updated).not.toContain('experimentalAstAwareRemapping:');
      // Unrelated coverage options are preserved.
      expect(updated).toContain("provider: 'v8'");
      expect(updated).toContain("reporter: ['text']");
    });

    it('does not touch a property named `all` outside test.coverage', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: { all: true } },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      await migrateToVitest4(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
    });
  });

  describe('test.workspace → test.projects (V4-2)', () => {
    it('renames the identifier inside test', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { workspace: ['apps/*', 'libs/*'] },
});
`
      );

      await migrateToVitest4(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toContain('projects: ');
    });

    it('logs unhandled when the external vitest.workspace file form is present', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.workspace.ts',
        `import { defineWorkspace } from 'vitest/config';\nexport default defineWorkspace(['apps/*']);\n`
      );

      const result = await migrateToVitest4(tree);

      expect(
        result?.promptContext?.some((s) => s.includes('vitest.workspace'))
      ).toBe(true);
      // The defineWorkspace import is flagged separately.
      expect(
        result?.promptContext?.some((s) => s.includes('defineWorkspace'))
      ).toBe(true);
    });
  });

  describe('@vitest/browser/context → vitest/browser import path (V4-3a)', () => {
    it('rewrites the import path', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'libs/lib/src/setup.ts',
        `import { page } from '@vitest/browser/context';\nexport { page };\n`
      );

      await migrateToVitest4(tree);

      expect(tree.read('libs/lib/src/setup.ts', 'utf-8')).toContain(
        "from 'vitest/browser'"
      );
    });

    it('logs unhandled for @vitest/browser/utils imports', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'libs/lib/src/util.ts',
        `import { getElementError } from '@vitest/browser/utils';\nexport { getElementError };\n`
      );

      const result = await migrateToVitest4(tree);

      expect(
        result?.promptContext?.some((s) => s.includes('@vitest/browser/utils'))
      ).toBe(true);
    });
  });

  describe('deps.optimizer.web → client (V4-4)', () => {
    it('renames inside test.deps.optimizer only', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    deps: {
      optimizer: { web: { include: ['x'] } },
    },
  },
});
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).toContain('client: ');
      expect(updated).not.toContain('web: ');
    });
  });

  describe('remove poolOptions.threads.useAtomics (V4-5)', () => {
    it('removes the property', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    poolOptions: { threads: { useAtomics: true, isolate: false } },
  },
});
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).not.toContain('useAtomics');
      // The detect-and-log path picks up isolate.
    });
  });

  describe('remove test.minWorkers (V4-6)', () => {
    it('removes the top-level property', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { minWorkers: 1, maxWorkers: 4 },
});
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).not.toContain('minWorkers');
      expect(updated).toContain('maxWorkers: 4');
    });
  });

  describe('reporter renames (V4-7)', () => {
    it("rewrites 'verbose' → 'tree' and 'basic' → ['default', { summary: false }]", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { reporters: ['verbose', 'basic', 'json'] },
});
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).toContain("'tree'");
      expect(updated).toContain("['default', { summary: false }]");
      expect(updated).toContain("'json'");
      expect(updated).not.toContain("'verbose'");
      expect(updated).not.toContain("'basic'");
    });
  });

  describe('env var renames in package.json (V4-8)', () => {
    it('renames VITEST_MAX_THREADS / VITEST_MAX_FORKS / VITE_NODE_DEPS_MODULE_DIRECTORIES', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            scripts: {
              t1: 'VITEST_MAX_THREADS=4 vitest run',
              t2: 'VITEST_MAX_FORKS=2 vitest run',
              t3: 'VITE_NODE_DEPS_MODULE_DIRECTORIES=/x vitest run',
              t4: 'echo VITEST_MAX_THREADSXYZ', // word-boundary
            },
          },
          null,
          2
        )
      );

      await migrateToVitest4(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(updated.scripts.t1).toBe('VITEST_MAX_WORKERS=4 vitest run');
      expect(updated.scripts.t2).toBe('VITEST_MAX_WORKERS=2 vitest run');
      expect(updated.scripts.t3).toBe(
        'VITEST_MODULE_DIRECTORIES=/x vitest run'
      );
      expect(updated.scripts.t4).toBe('echo VITEST_MAX_THREADSXYZ');
    });
  });

  describe('detect-and-log pool/deps/match/browser/reporter cases', () => {
    it('logs all the v4-only-via-prompt cases when they appear', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    singleThread: true,
    maxThreads: 4,
    poolMatchGlobs: [['**/*.gpu.test.ts', 'threads']],
    environmentMatchGlobs: [['**/*.dom.test.ts', 'jsdom']],
    deps: { external: ['pkg'], inline: ['pkg2'] },
    poolOptions: {
      forks: { execArgv: ['--expose-gc'], isolate: false },
      vmThreads: { memoryLimit: '512MB' },
    },
    browser: {
      enabled: true,
      provider: 'playwright',
      testerScripts: ['./s.js'],
    },
    reporters: [{ onCollected() {}, onFinished() {} }],
  },
});
`
      );

      const result = await migrateToVitest4(tree);
      const ctx = (result?.promptContext ?? []).join('\n');

      expect(ctx).toMatch(/singleThread/);
      expect(ctx).toMatch(/maxThreads/);
      expect(ctx).toMatch(/poolMatchGlobs/);
      expect(ctx).toMatch(/environmentMatchGlobs/);
      expect(ctx).toMatch(/test\.deps\.external/);
      expect(ctx).toMatch(/test\.deps\.inline/);
      expect(ctx).toMatch(/poolOptions\.<pool>\.execArgv/);
      expect(ctx).toMatch(/poolOptions\.<pool>\.isolate/);
      expect(ctx).toMatch(/poolOptions\.vmThreads\.memoryLimit/);
      expect(ctx).toMatch(/browser\.provider/);
      expect(ctx).toMatch(/browser\.testerScripts/);
      expect(ctx).toMatch(/onCollected/);
      expect(ctx).toMatch(/onFinished/);
    });

    it('logs @vitest/browser package.json dep but does not remove it', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          { devDependencies: { '@vitest/browser': '^3.0.0' } },
          null,
          2
        )
      );

      const result = await migrateToVitest4(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(updated.devDependencies['@vitest/browser']).toBe('^3.0.0');
      expect(
        result?.promptContext?.some((s) => s.includes('@vitest/browser'))
      ).toBe(true);
    });
  });

  describe('shape-agnostic anchoring', () => {
    it('applies and detects inside mergeConfig + factory-form configs', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.base.ts',
        `import { defineConfig, mergeConfig } from 'vitest/config';
const base = defineConfig({ test: { coverage: { all: true } } });
export default mergeConfig(
  base,
  defineConfig(({ mode }) => ({
    test: { workspace: ['apps/*'], minWorkers: 0 },
  }))
);
`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('vitest.config.base.ts', 'utf-8');
      expect(updated).toContain('projects: ');
      expect(updated).not.toContain('workspace: ');
      expect(updated).not.toContain('minWorkers');
      expect(updated).not.toContain('all:');
    });
  });

  describe('idempotency', () => {
    it('is a no-op on a second run', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          { scripts: { t: 'VITEST_MAX_THREADS=4 vitest run' } },
          null,
          2
        )
      );
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: { all: true, provider: 'v8' },
    workspace: ['apps/*'],
    minWorkers: 1,
    deps: { optimizer: { web: { include: ['x'] } } },
    poolOptions: { threads: { useAtomics: true } },
    reporters: ['verbose', 'basic'],
  },
});
`
      );

      await migrateToVitest4(tree);
      const afterFirst = {
        pkg: tree.read('package.json', 'utf-8'),
        cfg: tree.read('vitest.config.ts', 'utf-8'),
      };
      await migrateToVitest4(tree);
      const afterSecond = {
        pkg: tree.read('package.json', 'utf-8'),
        cfg: tree.read('vitest.config.ts', 'utf-8'),
      };

      expect(afterSecond).toEqual(afterFirst);
    });
  });

  describe('no-op when nothing matches', () => {
    it('leaves files untouched and returns no promptContext', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      const result = await migrateToVitest4(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
      expect(result).toBeUndefined();
    });
  });
});

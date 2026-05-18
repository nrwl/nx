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

      // singleThread: true → value-aware message including the literal.
      expect(ctx).toMatch(/`singleThread: true`/);
      // maxThreads: 4 → value-aware message including the literal.
      expect(ctx).toMatch(/`test\.maxThreads` \(current value: 4\)/);
      expect(ctx).toMatch(/poolMatchGlobs/);
      expect(ctx).toMatch(/environmentMatchGlobs/);
      expect(ctx).toMatch(/test\.deps\.external/);
      expect(ctx).toMatch(/test\.deps\.inline/);
      // Pool name is resolved to the exact `forks`/`threads` source, not `<pool>`.
      expect(ctx).toMatch(/test\.poolOptions\.forks\.execArgv/);
      expect(ctx).toMatch(/test\.poolOptions\.forks\.isolate/);
      expect(ctx).toMatch(/test\.poolOptions\.vmThreads\.memoryLimit/);
      expect(ctx).toMatch(/browser\.provider.*current value: 'playwright'/);
      expect(ctx).toMatch(/browser\.testerScripts/);
      expect(ctx).toMatch(/onCollected/);
      expect(ctx).toMatch(/onFinished/);
    });

    it('preserves boolean value context for singleThread/singleFork', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { singleFork: false },
});
`
      );

      const result = await migrateToVitest4(tree);
      const ctx = (result?.promptContext ?? []).join('\n');

      // false-value emits a delete-only instruction.
      expect(ctx).toMatch(/singleFork: false.*Delete the property/);
    });

    it('flags bare `@vitest/browser` imports', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'libs/lib/src/setup.ts',
        `import { something } from '@vitest/browser';\nexport { something };\n`
      );

      const result = await migrateToVitest4(tree);

      expect(
        result?.promptContext?.some((s) => /bare `@vitest\/browser`/.test(s))
      ).toBe(true);
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
    it('leaves files untouched and returns only the CI-dashboard nextSteps', async () => {
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
      // nextSteps is always emitted — the CI-provider-dashboard reminder.
      expect(result?.nextSteps?.[0]).toMatch(/CI provider/);
      expect(result?.promptContext).toBeUndefined();
    });
  });

  describe('.env file rewrites (V4-8 — extended)', () => {
    it('renames the legacy vars when exactly one of THREADS/FORKS is present', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        '.env',
        `# vitest workers\nVITEST_MAX_THREADS=4\nexport VITE_NODE_DEPS_MODULE_DIRECTORIES=/custom\n`
      );

      await migrateToVitest4(tree);

      const updated = tree.read('.env', 'utf-8');
      expect(updated).toContain('VITEST_MAX_WORKERS=4');
      expect(updated).not.toContain('VITEST_MAX_THREADS');
      expect(updated).toContain('export VITEST_MODULE_DIRECTORIES=/custom');
      // Comment preserved.
      expect(updated).toContain('# vitest workers');
    });

    it('renames in `.env.local` and `.env.production` too', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write('.env.local', `VITEST_MAX_FORKS=2\n`);
      tree.write('.env.production', `VITEST_MAX_FORKS=8\n`);

      await migrateToVitest4(tree);

      expect(tree.read('.env.local', 'utf-8')).toBe('VITEST_MAX_WORKERS=2\n');
      expect(tree.read('.env.production', 'utf-8')).toBe(
        'VITEST_MAX_WORKERS=8\n'
      );
    });

    it('skips rename when both VITEST_MAX_{THREADS,FORKS} are present and logs the conflict', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const original = `VITEST_MAX_THREADS=4\nVITEST_MAX_FORKS=2\n`;
      tree.write('.env', original);

      const result = await migrateToVitest4(tree);

      expect(tree.read('.env', 'utf-8')).toBe(original);
      expect(
        result?.promptContext?.some(
          (s) =>
            s.includes('.env') &&
            s.includes('VITEST_MAX_THREADS') &&
            s.includes('VITEST_MAX_FORKS')
        )
      ).toBe(true);
    });

    it('does not touch `.envrc` (direnv has different syntax)', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const original = `export VITEST_MAX_THREADS=4\n`;
      tree.write('.envrc', original);

      await migrateToVitest4(tree);

      expect(tree.read('.envrc', 'utf-8')).toBe(original);
    });
  });

  describe('project.json rewrites (V4-8 — extended)', () => {
    it('renames `options.env` keys with conflict guard', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app/project.json',
        JSON.stringify(
          {
            name: 'app',
            targets: {
              test: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    VITEST_MAX_THREADS: '4',
                    VITE_NODE_DEPS_MODULE_DIRECTORIES: '/x',
                  },
                  command: 'vitest run',
                },
              },
              testBoth: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    VITEST_MAX_THREADS: '4',
                    VITEST_MAX_FORKS: '2',
                  },
                  command: 'vitest run',
                },
              },
            },
          },
          null,
          2
        )
      );

      const result = await migrateToVitest4(tree);

      const updated = JSON.parse(tree.read('apps/app/project.json', 'utf-8'));
      // First target: single rename happens.
      expect(updated.targets.test.options.env).toEqual({
        VITEST_MAX_WORKERS: '4',
        VITEST_MODULE_DIRECTORIES: '/x',
      });
      // Second target: conflict → no rename, log emitted.
      expect(updated.targets.testBoth.options.env).toEqual({
        VITEST_MAX_THREADS: '4',
        VITEST_MAX_FORKS: '2',
      });
      expect(
        result?.promptContext?.some((s) => s.includes('target `testBoth`'))
      ).toBe(true);
    });

    it('rewrites inline VAR= prefixes inside options.command / options.commands / options.args', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app/project.json',
        JSON.stringify(
          {
            name: 'app',
            targets: {
              t1: {
                options: { command: 'VITEST_MAX_THREADS=4 vitest run' },
              },
              t2: {
                options: {
                  commands: [
                    'VITEST_MAX_FORKS=2 vitest run --shard=1/2',
                    'VITE_NODE_DEPS_MODULE_DIRECTORIES=/x vitest run',
                  ],
                },
              },
              t3: {
                options: { args: 'VITEST_MAX_THREADS=4' },
              },
            },
          },
          null,
          2
        )
      );

      await migrateToVitest4(tree);

      const updated = JSON.parse(tree.read('apps/app/project.json', 'utf-8'));
      expect(updated.targets.t1.options.command).toBe(
        'VITEST_MAX_WORKERS=4 vitest run'
      );
      expect(updated.targets.t2.options.commands).toEqual([
        'VITEST_MAX_WORKERS=2 vitest run --shard=1/2',
        'VITEST_MODULE_DIRECTORIES=/x vitest run',
      ]);
      expect(updated.targets.t3.options.args).toBe('VITEST_MAX_WORKERS=4');
    });
  });

  describe('CI YAML scan (V4-8 — extended)', () => {
    it('logs the file path + tokens found in .github/workflows files', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        '.github/workflows/test.yml',
        `jobs:\n  test:\n    runs-on: ubuntu-latest\n    env:\n      VITEST_MAX_THREADS: 4\n    steps:\n      - run: pnpm test\n`
      );

      const result = await migrateToVitest4(tree);

      const ciEntry = result?.promptContext?.find((s) =>
        s.startsWith('.github/workflows/test.yml')
      );
      expect(ciEntry).toBeDefined();
      expect(ciEntry).toContain('VITEST_MAX_THREADS');
      // The file is not mechanically edited (YAML structure risk).
      expect(tree.read('.github/workflows/test.yml', 'utf-8')).toContain(
        'VITEST_MAX_THREADS'
      );
    });
  });

  describe('CI provider nextSteps (always emitted)', () => {
    it('appears even when no in-repo env vars were found', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { globals: true } });\n`
      );

      const result = await migrateToVitest4(tree);

      expect(
        result?.nextSteps?.some((s) =>
          s.includes('CI provider stores Vitest env vars')
        )
      ).toBe(true);
    });
  });
});

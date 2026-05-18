import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateToVitest3 from './migrate-to-vitest-3';

describe('migrate-to-vitest-3', () => {
  describe('--segfault-retry removal (V3-1)', () => {
    it('strips --segfault-retry with and without numeric arg from package.json scripts', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            scripts: {
              a: 'vitest run --segfault-retry=3',
              b: 'vitest run --segfault-retry 5 --reporter=verbose',
              c: 'vitest run --segfault-retry',
              d: 'vitest run',
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(updated.scripts).toEqual({
        a: 'vitest run',
        b: 'vitest run --reporter=verbose',
        c: 'vitest run',
        d: 'vitest run',
      });
    });
  });

  describe('coverage-c8 → coverage-v8 (V3-2)', () => {
    it('renames the package.json dep while preserving the user pin and order', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            devDependencies: {
              eslint: '^9.0.0',
              '@vitest/coverage-c8': '~0.34.6',
              vitest: '^3.0.0',
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(Object.keys(updated.devDependencies)).toEqual([
        'eslint',
        '@vitest/coverage-v8',
        'vitest',
      ]);
      expect(updated.devDependencies['@vitest/coverage-v8']).toBe('~0.34.6');
    });

    it('drops the c8 key when v8 is already present (avoids overwriting user pin)', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            devDependencies: {
              '@vitest/coverage-c8': '~0.34.6',
              '@vitest/coverage-v8': '^3.0.0',
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(updated.devDependencies).toEqual({
        '@vitest/coverage-v8': '^3.0.0',
      });
    });

    it("renames coverage.provider: 'c8' → 'v8' inside vitest config", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: { provider: 'c8', reporter: ['text'] },
  },
});
`
      );

      await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toContain(
        "provider: 'v8'"
      );
    });

    it("does not touch a `provider: 'c8'` outside test.coverage", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  // unrelated property happens to mention the same string
  define: { 'process.env.PROVIDER': "'c8'" },
  test: { coverage: { provider: 'v8' } },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
    });
  });

  describe('vitest typecheck flag (V3-3)', () => {
    it('rewrites `vitest typecheck` to `vitest --typecheck` in package.json scripts', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            scripts: {
              typecheck: 'vitest typecheck',
              chained: 'vitest typecheck --run && echo done',
              unrelated: 'echo vitest typecheck-helper',
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('package.json', 'utf-8'));
      expect(updated.scripts).toEqual({
        typecheck: 'vitest --typecheck',
        chained: 'vitest --typecheck --run && echo done',
        // word-boundary protects `typecheck-helper`.
        unrelated: 'echo vitest typecheck-helper',
      });
    });
  });

  describe('SnapshotEnvironment import path (V3-4)', () => {
    it("rewrites a sole `SnapshotEnvironment` import to 'vitest/snapshot'", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'libs/lib/src/snap.ts',
        `import { SnapshotEnvironment } from 'vitest';\nexport default SnapshotEnvironment;\n`
      );

      await migrateToVitest3(tree);

      expect(tree.read('libs/lib/src/snap.ts', 'utf-8')).toContain(
        "from 'vitest/snapshot'"
      );
    });

    it('logs unhandled when SnapshotEnvironment is mixed with other vitest bindings', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'libs/lib/src/snap.ts',
        `import { SnapshotEnvironment, vi } from 'vitest';\nexport default SnapshotEnvironment;\nvi.fn();\n`
      );
      const before = tree.read('libs/lib/src/snap.ts', 'utf-8');

      const result = await migrateToVitest3(tree);

      expect(tree.read('libs/lib/src/snap.ts', 'utf-8')).toBe(before);
      expect(result?.promptContext?.[0]).toMatch(
        /SnapshotEnvironment.*Split it into a separate/
      );
    });
  });

  describe("browser.provider 'none' → 'preview' (V3-5)", () => {
    it('rewrites only the provider literal inside test.browser', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    browser: { enabled: true, provider: 'none' },
  },
});
`
      );

      await migrateToVitest3(tree);

      const updated = tree.read('vitest.config.ts', 'utf-8');
      expect(updated).toContain("provider: 'preview'");
      expect(updated).not.toContain("provider: 'none'");
    });
  });

  describe('browser.indexScripts → orchestratorScripts (V3-6)', () => {
    it('renames the identifier inside test.browser', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    browser: { indexScripts: ['./setup.js'] },
  },
});
`
      );

      await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toContain(
        'orchestratorScripts: '
      );
    });
  });

  describe('shape-agnostic anchoring', () => {
    it('applies transforms inside a `mergeConfig`-wrapped, factory-form config', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.base.ts',
        `import { defineConfig, mergeConfig } from 'vitest/config';
const base = defineConfig({ test: { coverage: { provider: 'c8' } } });
export default mergeConfig(
  base,
  defineConfig(({ mode }) => ({
    test: {
      browser: { provider: 'none', indexScripts: ['./s.js'] },
    },
  }))
);
`
      );

      await migrateToVitest3(tree);

      const updated = tree.read('vitest.config.base.ts', 'utf-8');
      expect(updated).toContain("provider: 'v8'");
      expect(updated).toContain("provider: 'preview'");
      expect(updated).toContain('orchestratorScripts:');
      expect(updated).not.toContain("provider: 'c8'");
      expect(updated).not.toContain("provider: 'none'");
      expect(updated).not.toContain('indexScripts');
    });
  });

  describe('idempotency', () => {
    it('is a no-op on a second run', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'package.json',
        JSON.stringify(
          {
            scripts: { test: 'vitest run --segfault-retry=3' },
            devDependencies: { '@vitest/coverage-c8': '~0.34.6' },
          },
          null,
          2
        )
      );
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: { provider: 'c8' },
    browser: { provider: 'none', indexScripts: ['./s.js'] },
  },
});
`
      );

      await migrateToVitest3(tree);
      const afterFirst = {
        pkg: tree.read('package.json', 'utf-8'),
        cfg: tree.read('vitest.config.ts', 'utf-8'),
      };
      await migrateToVitest3(tree);
      const afterSecond = {
        pkg: tree.read('package.json', 'utf-8'),
        cfg: tree.read('vitest.config.ts', 'utf-8'),
      };

      expect(afterSecond).toEqual(afterFirst);
    });
  });

  describe('project.json rewrites (V3-1 / V3-3 — extended)', () => {
    it('strips --segfault-retry from options.args/command/commands', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app/project.json',
        JSON.stringify(
          {
            name: 'app',
            targets: {
              tArgsString: {
                options: { args: '--segfault-retry=3 --reporter=verbose' },
              },
              tArgsArray: {
                options: {
                  args: ['--segfault-retry=3', '--reporter=verbose'],
                },
              },
              tCommand: {
                options: { command: 'vitest run --segfault-retry 5' },
              },
              tCommands: {
                options: { commands: ['vitest run --segfault-retry'] },
              },
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('apps/app/project.json', 'utf-8'));
      expect(updated.targets.tArgsString.options.args).toBe(
        '--reporter=verbose'
      );
      expect(updated.targets.tArgsArray.options.args).toEqual([
        '--reporter=verbose',
      ]);
      expect(updated.targets.tCommand.options.command).toBe('vitest run');
      expect(updated.targets.tCommands.options.commands).toEqual([
        'vitest run',
      ]);
    });

    it('rewrites `vitest typecheck` to `vitest --typecheck` inside command/commands/args', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app/project.json',
        JSON.stringify(
          {
            name: 'app',
            targets: {
              typecheck: { options: { command: 'vitest typecheck --run' } },
              typecheckAll: {
                options: {
                  commands: ['pnpm exec vitest typecheck'],
                },
              },
            },
          },
          null,
          2
        )
      );

      await migrateToVitest3(tree);

      const updated = JSON.parse(tree.read('apps/app/project.json', 'utf-8'));
      expect(updated.targets.typecheck.options.command).toBe(
        'vitest --typecheck --run'
      );
      expect(updated.targets.typecheckAll.options.commands).toEqual([
        'pnpm exec vitest --typecheck',
      ]);
    });
  });

  describe('CI YAML scan (V3-1 / V3-3 — extended)', () => {
    it('logs the file path + tokens found in .github/workflows files', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        '.github/workflows/test.yml',
        `jobs:\n  test:\n    steps:\n      - run: pnpm vitest typecheck\n      - run: pnpm vitest run --segfault-retry=3\n`
      );

      const result = await migrateToVitest3(tree);

      const ciEntry = result?.promptContext?.find((s) =>
        s.startsWith('.github/workflows/test.yml')
      );
      expect(ciEntry).toBeDefined();
      expect(ciEntry).toContain('--segfault-retry');
      expect(ciEntry).toContain('vitest typecheck');
      // CI file is not mechanically rewritten.
      expect(tree.read('.github/workflows/test.yml', 'utf-8')).toContain(
        '--segfault-retry'
      );
    });
  });

  describe('substring fallback for indirected shapes', () => {
    it("logs when 'c8' substring appears but no direct coverage.provider AST assignment", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
const PROVIDER = 'c8';
export default defineConfig({
  test: { coverage: { provider: PROVIDER } },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      const result = await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
      expect(
        result?.promptContext?.some((s) =>
          /vitest\.config\.ts.*'c8'.*resolves to c8/.test(s)
        )
      ).toBe(true);
    });

    it("logs when 'indexScripts' substring appears but no direct browser.indexScripts AST assignment", async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
const SCRIPTS_KEY = 'indexScripts';
export default defineConfig({
  test: { browser: { [SCRIPTS_KEY]: ['./s.js'] } },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      const result = await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
      expect(
        result?.promptContext?.some((s) =>
          /vitest\.config\.ts.*indexScripts.*orchestratorScripts/.test(s)
        )
      ).toBe(true);
    });
  });

  describe('no-op when nothing matches', () => {
    it('leaves files untouched and returns no promptContext', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { coverage: { provider: 'v8' } },
});
`
      );
      const before = tree.read('vitest.config.ts', 'utf-8');

      const result = await migrateToVitest3(tree);

      expect(tree.read('vitest.config.ts', 'utf-8')).toBe(before);
      expect(result).toBeUndefined();
    });
  });
});

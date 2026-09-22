import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateToVitest5 from './migrate-to-vitest-5';

describe('migrate-to-vitest-5', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('removed entry points', () => {
    it('should repoint the entry points that moved wholesale', async () => {
      tree.write(
        'libs/mylib/src/reporter.ts',
        `import type { Reporter } from 'vitest/reporters';
import type { CoverageProvider } from 'vitest/coverage';
import type { VitestRunner } from 'vitest/runners';
import { SnapshotEnvironment } from 'vitest/snapshot';
import { getCurrentSuite } from 'vitest/suite';
`
      );

      await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/reporter.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import type { Reporter } from 'vitest/node';
        import type { CoverageProvider } from 'vitest/node';
        import type { VitestRunner } from 'vitest/runtime';
        import { SnapshotEnvironment } from 'vitest/runtime';
        import { getCurrentSuite } from 'vitest';
        "
      `);
    });

    it('should rewrite re-export specifiers too', async () => {
      tree.write(
        'libs/mylib/src/index.ts',
        `export type { Reporter } from 'vitest/reporters';\n`
      );

      await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/index.ts', 'utf-8')).toContain(
        `from 'vitest/node'`
      );
    });

    it('should hand vitest/environments to the agent rather than guess', async () => {
      tree.write(
        'libs/mylib/src/env.ts',
        `import { populateGlobal } from 'vitest/environments';\n`
      );

      const result = await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/env.ts', 'utf-8')).toContain(
        `from 'vitest/environments'`
      );
      expect(result.agentContext).toEqual([
        expect.stringContaining('libs/mylib/src/env.ts'),
      ]);
    });

    it('should leave supported entry points alone', async () => {
      const contents = `import { defineConfig } from 'vitest/config';
import { createVitest } from 'vitest/node';
`;
      tree.write('libs/mylib/src/run.ts', contents);

      await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/run.ts', 'utf-8')).toBe(contents);
    });
  });

  describe('sequential usage', () => {
    it('should hand test.sequential to the agent rather than guess', async () => {
      tree.write(
        'libs/mylib/src/a.spec.ts',
        `describe.sequential('suite', () => {
  test.sequential('a', () => {});
});
`
      );

      const result = await migrateToVitest5(tree);

      expect(result.agentContext).toEqual([
        expect.stringContaining('libs/mylib/src/a.spec.ts'),
      ]);
    });

    it('should report the sequential test option', async () => {
      tree.write(
        'libs/mylib/src/b.spec.ts',
        `test('b', { sequential: true }, () => {});\n`
      );

      const result = await migrateToVitest5(tree);

      expect(result.agentContext).toEqual([
        expect.stringContaining('libs/mylib/src/b.spec.ts'),
      ]);
    });

    it('should not rewrite anything, since the replacement depends on context', async () => {
      const contents = `test.sequential('a', () => {});\n`;
      tree.write('libs/mylib/src/c.spec.ts', contents);

      await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/c.spec.ts', 'utf-8')).toBe(contents);
    });

    it('should ignore a file with no sequential usage', async () => {
      tree.write('libs/mylib/src/d.spec.ts', `test('d', () => {});\n`);

      const result = await migrateToVitest5(tree);

      expect(result.agentContext).toBeUndefined();
    });
  });

  describe('unrewritable specifiers', () => {
    it('should report removed entry points reached dynamically', async () => {
      tree.write(
        'libs/mylib/src/dyn.ts',
        `const m = await import('vitest/reporters');
const r = require('vitest/runners');
type R = import('vitest/snapshot').SnapshotEnvironment;
`
      );

      const result = await migrateToVitest5(tree);

      expect(tree.read('libs/mylib/src/dyn.ts', 'utf-8')).toContain(
        `import('vitest/reporters')`
      );
      expect(result.agentContext).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vitest/reporters'),
          expect.stringContaining('vitest/runners'),
          expect.stringContaining('vitest/snapshot'),
        ])
      );
    });
  });

  describe('vite peer dependency', () => {
    it('should declare vite when only vitest is present', async () => {
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { vitest: '^5.0.0' } })
      );

      const result = await migrateToVitest5(tree);

      expect(readJson(tree, 'package.json').devDependencies.vite).toBe(
        '^8.0.0'
      );
      expect(result.nextSteps).toEqual([expect.stringContaining('vite')]);
    });

    it('should preserve an existing vite pin', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          devDependencies: { vitest: '^5.0.0', vite: '^7.0.0' },
        })
      );

      const result = await migrateToVitest5(tree);

      expect(readJson(tree, 'package.json').devDependencies.vite).toBe(
        '^7.0.0'
      );
      expect(result.nextSteps).toBeUndefined();
    });

    it('should not add vite to a workspace that does not use vitest', async () => {
      tree.write('package.json', JSON.stringify({ devDependencies: {} }));

      await migrateToVitest5(tree);

      expect(
        readJson(tree, 'package.json').devDependencies.vite
      ).toBeUndefined();
    });
  });

  describe('gitignore', () => {
    it('should ignore the new .vitest artifacts directory', async () => {
      tree.write('.gitignore', 'node_modules\n');

      await migrateToVitest5(tree);

      expect(tree.read('.gitignore', 'utf-8')).toBe('node_modules\n.vitest\n');
    });

    it('should not duplicate an existing entry', async () => {
      tree.write('.gitignore', 'node_modules\n.vitest\n');

      await migrateToVitest5(tree);

      expect(tree.read('.gitignore', 'utf-8')).toBe('node_modules\n.vitest\n');
    });
  });
});

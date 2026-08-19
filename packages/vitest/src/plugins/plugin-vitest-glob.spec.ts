import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { createNodesV2 } from './plugin';
import { loadViteDynamicImport } from '../utils/executor-utils';

// Only the Vite/Vitest module loading is mocked; the filesystem and the
// workspace-context glob are real. These tests pin the native glob's semantics
// for the patterns Vitest resolves with (the extglob default include, `**`
// matching zero segments, ignore-file behavior) against real files.
jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn(),
  loadVitestConfigDynamicImport: jest.fn().mockResolvedValue({
    configDefaults: {
      include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**', '**/.git/**'],
      typecheck: {
        include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
        exclude: ['**/node_modules/**', '**/.git/**'],
      },
    },
  }),
}));

jest.mock('vitest/node', () => ({
  createVitest: jest.fn(() => {
    throw new Error('these tests must take the glob discovery path');
  }),
}));

process.env.NX_DAEMON = 'false';
process.env.NX_CACHE_PROJECT_GRAPH = 'false';

describe('@nx/vitest glob discovery against a real filesystem', () => {
  const createNodesFunction = createNodesV2[1];
  let temp: TempFs;
  let context: CreateNodesContext;

  function mockResolvedTestConfig(
    test: Record<string, any>,
    rawRoot?: string,
    userConfigHook?: (config: {
      root?: string;
      test?: Record<string, any>;
    }) => { root?: string } | undefined
  ): void {
    (loadViteDynamicImport as jest.Mock).mockResolvedValue({
      resolveConfig: jest
        .fn()
        .mockImplementation(async (inlineConfig: Record<string, any>) => {
          // Emulates the phase ordering of vite's config hooks (pre, then
          // normal user hooks, then post) for the root value only, which
          // is all these tests exercise (verified against vite 5.4 and
          // 8.2).
          let root = rawRoot;
          const runHook = (plugin: Record<string, any>) => {
            const hook =
              typeof plugin.config === 'function'
                ? plugin.config
                : plugin.config?.handler;
            return hook?.({ root, test });
          };
          for (const plugin of inlineConfig?.plugins ?? []) {
            if (plugin.enforce === 'pre') {
              root = runHook(plugin)?.root ?? root;
            }
          }
          root = userConfigHook?.({ root, test })?.root ?? root;
          for (const plugin of inlineConfig?.plugins ?? []) {
            if (plugin.enforce === 'post') {
              runHook(plugin);
            }
          }
          return {
            path: 'vitest.config.ts',
            config: {},
            dependencies: [],
            test,
          };
        }),
    });
  }

  async function getAtomizedTargets(configFile: string): Promise<string[]> {
    const nodes = await createNodesFunction(
      [configFile],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const [, result] = nodes[0];
    const project = Object.values(result.projects!)[0];
    return Object.keys(project.targets!)
      .filter((name) => name.startsWith('test-ci--'))
      .sort();
  }

  beforeEach(async () => {
    temp = new TempFs('vitest-plugin-glob');
    await temp.createFiles({
      'nx.json': '{}',
      'package.json': '{"name":"repo"}',
      '.gitignore': 'node_modules/\ngenerated/\n',
    });
    context = {
      nxJsonConfiguration: {
        targetDefaults: {},
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: temp.tempDir,
      configFiles: [],
    };
  });

  afterEach(() => {
    temp.cleanup();
    jest.clearAllMocks();
  });

  it('should discover spec files matching the Vitest extglob default include', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/src/b.test.tsx': '',
      'libs/lib1/src/deep/nested/c.spec.mts': '',
      'libs/lib1/src/helper.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([
      'test-ci--src/a.spec.ts',
      'test-ci--src/b.test.tsx',
      'test-ci--src/deep/nested/c.spec.mts',
    ]);
  });

  it('should scope discovery to the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib2/vitest.config.ts': '',
      'libs/lib2/package.json': '{"name":"lib2"}',
      'libs/lib2/src/other.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should drop files an include pattern reaches outside the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib2/package.json': '{"name":"lib2"}',
      'libs/lib2/src/other.spec.ts': '',
    });
    // An escaping pattern resolves to a real workspace path (`libs/lib2/**`),
    // so the glob matches lib2's spec; only the project-root filter drops it.
    mockResolvedTestConfig({
      include: ['src/**/*.spec.ts', '../lib2/**/*.spec.ts'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should honor config include/exclude, with `**` matching zero segments', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      // `custom/**/*.spec.ts` must match a file directly in `custom` and
      // `**/skip/**` must exclude a directory directly under the project root
      // both require `**` to match zero path segments, like Vitest's glob.
      'libs/lib1/custom/a.spec.ts': '',
      'libs/lib1/custom/deep/b.spec.ts': '',
      'libs/lib1/custom/skip/c.spec.ts': '',
      'libs/lib1/skip/d.spec.ts': '',
      'libs/lib1/src/not-included.spec.ts': '',
    });
    mockResolvedTestConfig({
      include: ['custom/**/*.spec.ts', 'skip/**/*.spec.ts'],
      exclude: ['**/skip/**'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([
      'test-ci--custom/a.spec.ts',
      'test-ci--custom/deep/b.spec.ts',
    ]);
  });

  it('should keep only in-source candidates containing the vitest marker', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/with-tests.ts':
        'export const x = 1;\nif (import.meta.vitest) { /* in-source test */ }\n',
      'libs/lib1/src/plain.ts': 'export const y = 2;\n',
    });
    mockResolvedTestConfig({ includeSource: ['src/**/*.ts'] });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/with-tests.ts']);
  });

  it('should not discover ignored files (discovery follows the workspace file index)', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      // `generated/` is gitignored at the workspace root; Vitest itself would
      // run this file, but files ignored by git are not candidates here.
      'libs/lib1/generated/gen.spec.ts': '',
      'libs/lib1/node_modules/dep/d.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should discover tests for a workspace-root project', async () => {
    await temp.createFiles({
      'vitest.config.ts': '',
      'src/root.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(getAtomizedTargets('vitest.config.ts')).resolves.toEqual([
      'test-ci--src/root.spec.ts',
    ]);
  });

  it('should discover a workspace-root project using the generated multi-brace include', async () => {
    await temp.createFiles({
      'vitest.config.ts': '',
      'src/a.spec.ts': '',
      'tests/b.test.tsx': '',
      'src/helper.ts': '',
    });
    // The vite/vitest generators write this include; for a root project it
    // reaches the workspace glob unprefixed, so it starts with `{`, ends with
    // `}`, and spans three brace groups.
    mockResolvedTestConfig({
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    });

    await expect(getAtomizedTargets('vitest.config.ts')).resolves.toEqual([
      'test-ci--src/a.spec.ts',
      'test-ci--tests/b.test.tsx',
    ]);
  });

  it('should honor a negated include pattern', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/src/b.slow.spec.ts': '',
    });
    mockResolvedTestConfig({
      include: ['**/*.spec.ts', '!**/*.slow.spec.ts'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should ignore a negated exclude pattern, as Vitest does', async () => {
    await temp.createFiles({
      'vitest.config.ts': '',
      'src/a.spec.ts': '',
      'src/b.spec.ts': '',
    });
    // Vitest drops a negated `exclude` entry. A root project hands its patterns
    // to the workspace glob unprefixed, where forwarding one would flip the
    // exclude set into an allowlist and leave only `a.spec.ts`.
    mockResolvedTestConfig({ exclude: ['!src/a.spec.ts'] });

    await expect(getAtomizedTargets('vitest.config.ts')).resolves.toEqual([
      'test-ci--src/a.spec.ts',
      'test-ci--src/b.spec.ts',
    ]);
  });

  it('should enumerate from test.dir instead of the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/tests/b.spec.ts': '',
    });
    mockResolvedTestConfig({ dir: 'tests' });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--tests/b.spec.ts']);
  });

  it('should anchor a root-relative exclude to the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      // `skip/**` must exclude only this project's `skip/`. Without anchoring it
      // to the project root, the workspace glob reads it at the workspace root
      // and never matches `libs/lib1/skip/**`, so the file leaks back in.
      'libs/lib1/skip/b.spec.ts': '',
    });
    mockResolvedTestConfig({
      include: ['**/*.spec.ts'],
      exclude: ['skip/**'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should produce no targets when every include pattern is negated', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/src/b.slow.spec.ts': '',
    });
    // An all-negated include has no positive entry. Vitest enumerates nothing;
    // the workspace glob would otherwise invert this to "match every file".
    mockResolvedTestConfig({ include: ['!**/*.slow.spec.ts'] });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([]);
  });

  it('should produce no targets when the include set is empty', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({ include: [] });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([]);
  });

  it('should give each atomized target its own coverage directory', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/src/b.spec.ts': '',
    });
    mockResolvedTestConfig({});

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--src/a.spec.ts'].command).toBe(
      `vitest run src/a.spec.ts --coverage.reportsDirectory="coverage/src/a.spec.ts"`
    );
    expect(targets['test-ci--src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/coverage/src/a.spec.ts`,
    ]);
    expect(targets['test-ci--src/b.spec.ts'].outputs).toEqual([
      `{projectRoot}/coverage/src/b.spec.ts`,
    ]);
  });

  it('should keep atomized coverage directories disjoint for paths a flattening scheme would collide', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.b.spec.ts': '',
      'libs/lib1/src/a/b.spec.ts': '',
    });
    mockResolvedTestConfig({});

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--src/a.b.spec.ts'].outputs).toEqual([
      `{projectRoot}/coverage/src/a.b.spec.ts`,
    ]);
    expect(targets['test-ci--src/a/b.spec.ts'].outputs).toEqual([
      `{projectRoot}/coverage/src/a/b.spec.ts`,
    ]);
  });

  it('should keep atomized coverage directory components within filesystem limits for multibyte paths', async () => {
    // Two 60-emoji directory components: each is a valid 240-byte name, but
    // flattened into one component they exceed the common 255-byte limit.
    // Mirroring the spec path reuses the source's own components verbatim.
    const emojiDir = '🙂'.repeat(60);
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      [`libs/lib1/${emojiDir}/${emojiDir}/a.spec.ts`]: '',
    });
    mockResolvedTestConfig({});

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    const atomOutputs = Object.entries(targets)
      .filter(([name]) => name.startsWith('test-ci--'))
      .flatMap(([, target]) => target.outputs!);
    expect(atomOutputs).toEqual([
      `{projectRoot}/coverage/${emojiDir}/${emojiDir}/a.spec.ts`,
    ]);
    for (const component of atomOutputs[0].split('/')) {
      expect(Buffer.byteLength(component, 'utf8')).toBeLessThanOrEqual(255);
    }
  });

  it('should handle an absolute configured reportsDirectory', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({
      coverage: { reportsDirectory: `${temp.tempDir}/coverage-abs` },
    });

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    // Keep this platform-aware: slash-joining would fail only on Windows.
    expect(targets['test-ci--src/a.spec.ts'].command).toBe(
      `vitest run src/a.spec.ts --coverage.reportsDirectory="${join(
        temp.tempDir,
        'coverage-abs',
        'libs/lib1/src/a.spec.ts'
      )}"`
    );
    expect(targets['test-ci--src/a.spec.ts'].outputs).toEqual([
      `{workspaceRoot}/coverage-abs/libs/lib1/src/a.spec.ts`,
    ]);
  });

  it('should resolve a relative reportsDirectory against an explicitly configured absolute vitest root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/test-root/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({}, `${temp.tempDir}/libs/lib1/test-root`);

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    // Vitest resolves the flag against its root, so the declared output must
    // sit under the root, not directly under the project root.
    expect(targets['test-ci--test-root/src/a.spec.ts'].command).toBe(
      `vitest run test-root/src/a.spec.ts --coverage.reportsDirectory="coverage/test-root/src/a.spec.ts"`
    );
    expect(targets['test-ci--test-root/src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/test-root/coverage/test-root/src/a.spec.ts`,
    ]);
  });

  it('should resolve a relative vitest root against the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/test-root/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({}, './test-root');

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    // At run time the atom's cwd is the project root, so a relative root
    // anchors there, and the coverage base under it.
    expect(targets['test-ci--test-root/src/a.spec.ts'].command).toBe(
      `vitest run test-root/src/a.spec.ts --coverage.reportsDirectory="coverage/test-root/src/a.spec.ts"`
    );
    expect(targets['test-ci--test-root/src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/test-root/coverage/test-root/src/a.spec.ts`,
    ]);
  });

  it('should promote test.root over the vite root when computing the coverage base', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/test-root/src/a.spec.ts': '',
    });
    // Vitest runs with `test.root` even when a top-level root is also set.
    mockResolvedTestConfig({ root: './test-root' }, './other-root');

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--test-root/src/a.spec.ts'].command).toBe(
      `vitest run test-root/src/a.spec.ts --coverage.reportsDirectory="coverage/test-root/src/a.spec.ts"`
    );
    expect(targets['test-ci--test-root/src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/test-root/coverage/test-root/src/a.spec.ts`,
    ]);
  });

  it('should let a user config hook override the promoted test.root as vitest does', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/hook-root/src/a.spec.ts': '',
    });
    // Vitest promotes test.root in its pre-enforce config hook, so a later
    // user hook overriding the top-level root wins at run time.
    mockResolvedTestConfig({ root: './test-root' }, undefined, () => ({
      root: './hook-root',
    }));

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--hook-root/src/a.spec.ts'].command).toBe(
      `vitest run hook-root/src/a.spec.ts --coverage.reportsDirectory="coverage/hook-root/src/a.spec.ts"`
    );
    expect(targets['test-ci--hook-root/src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/hook-root/coverage/hook-root/src/a.spec.ts`,
    ]);
  });

  it('should treat a reportsDirectory name starting with dots as inside the project', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({
      coverage: { reportsDirectory: '..coverage' },
    });

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--src/a.spec.ts'].command).toBe(
      `vitest run src/a.spec.ts --coverage.reportsDirectory="..coverage/src/a.spec.ts"`
    );
    expect(targets['test-ci--src/a.spec.ts'].outputs).toEqual([
      `{projectRoot}/..coverage/src/a.spec.ts`,
    ]);
  });

  it('should not prefix the project root when the configured reportsDirectory already ends with it', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({
      coverage: { reportsDirectory: '../../coverage/libs/lib1' },
    });

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--src/a.spec.ts'].command).toBe(
      `vitest run src/a.spec.ts --coverage.reportsDirectory="../../coverage/libs/lib1/src/a.spec.ts"`
    );
    expect(targets['test-ci--src/a.spec.ts'].outputs).toEqual([
      `{workspaceRoot}/coverage/libs/lib1/src/a.spec.ts`,
    ]);
  });

  it('should prefix the project root when the reportsDirectory is outside the project and does not identify it', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
    });
    mockResolvedTestConfig({
      coverage: { reportsDirectory: '../../reports' },
    });

    const nodes = await createNodesFunction(
      ['libs/lib1/vitest.config.ts'],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const targets = nodes[0][1].projects!['libs/lib1'].targets!;

    expect(targets['test-ci--src/a.spec.ts'].command).toBe(
      `vitest run src/a.spec.ts --coverage.reportsDirectory="../../reports/libs/lib1/src/a.spec.ts"`
    );
    expect(targets['test-ci--src/a.spec.ts'].outputs).toEqual([
      `{workspaceRoot}/reports/libs/lib1/src/a.spec.ts`,
    ]);
  });
});

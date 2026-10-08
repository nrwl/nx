import { vi } from 'vitest';
import type { BuildOptions, BuildResult, Plugin, PluginBuild } from 'esbuild';
import {
  ENTRY_POINT_BATCH_SIZE,
  mergeBuildResults,
  splitBuildOptionsIntoBatches,
  batchedBuild,
} from './batched-esbuild';

const buildResult = (partial: Partial<BuildResult> = {}): BuildResult =>
  ({
    errors: [],
    warnings: [],
    ...partial,
  }) as BuildResult;

const message = (text: string) =>
  ({
    id: '',
    text,
    location: null,
    notes: [],
    pluginName: '',
    detail: null,
  }) as BuildResult['errors'][number];

describe('splitBuildOptionsIntoBatches', () => {
  it('returns null when entry points are not an array', () => {
    expect(
      splitBuildOptionsIntoBatches({
        entryPoints: { in: 'a.ts', out: 'a' },
      } as BuildOptions)
    ).toBeNull();
  });

  it('returns null when entry point count is within the batch size', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE },
      (_, i) => `file-${i}.ts`
    );
    expect(
      splitBuildOptionsIntoBatches({ entryPoints } as BuildOptions)
    ).toBeNull();
  });

  it('splits large entry point arrays into fixed-size batches', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 1 },
      (_, i) => `file-${i}.ts`
    );
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
      outdir: 'dist',
    } as BuildOptions);

    expect(batches).toHaveLength(2);
    expect(batches![0].entryPoints).toHaveLength(ENTRY_POINT_BATCH_SIZE);
    expect(batches![1].entryPoints).toHaveLength(1);
    expect(batches![0].outdir).toBe('dist');
  });

  it('gives every batch the outbase shared by the whole entry set', () => {
    const entryPoints = [
      'src/main.ts',
      ...Array.from(
        { length: ENTRY_POINT_BATCH_SIZE },
        (_, i) => `src/lib/file-${i}.ts`
      ),
    ];
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
      absWorkingDir: '/ws',
    } as BuildOptions);

    expect(batches!.map((b) => b.outbase)).toEqual(['/ws/src', '/ws/src']);
  });

  it('keeps a user-provided outbase', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 1 },
      (_, i) => `src/file-${i}.ts`
    );
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
      outbase: 'custom',
    } as BuildOptions);

    expect(batches!.every((b) => b.outbase === 'custom')).toBe(true);
  });

  it('returns null when bundling', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 1 },
      (_, i) => `file-${i}.ts`
    );
    expect(
      splitBuildOptionsIntoBatches({
        entryPoints,
        bundle: true,
      } as BuildOptions)
    ).toBeNull();
  });

  it('keeps every entry point exactly once and in order', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE * 2 + 3 },
      (_, i) => `file-${i}.ts`
    );
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
    } as BuildOptions);

    expect(batches).toHaveLength(3);
    expect(batches!.flatMap((b) => b.entryPoints as string[])).toEqual(
      entryPoints
    );
  });

  it('computes outbase from { in } entries and absolute paths', () => {
    const entryPoints = [
      { in: 'apps/demo/src/main.ts', out: 'main' },
      { in: '/ws/libs/utils/src/index.ts', out: 'index' },
      ...Array.from({ length: ENTRY_POINT_BATCH_SIZE }, (_, i) => ({
        in: `apps/demo/src/f-${i}.ts`,
        out: `f-${i}`,
      })),
    ];
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
      absWorkingDir: '/ws',
    } as BuildOptions);

    expect(batches!.map((b) => b.outbase)).toEqual(['/ws', '/ws']);
  });

  it('falls back to the filesystem root when entries share no folder', () => {
    const entryPoints = [
      '/a/x.ts',
      '/b/y.ts',
      ...Array.from(
        { length: ENTRY_POINT_BATCH_SIZE },
        (_, i) => `/b/f-${i}.ts`
      ),
    ];
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
    } as BuildOptions);

    expect(batches![0].outbase).toBe('/');
  });

  it('preserves the remaining build options on every batch', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 1 },
      (_, i) => `file-${i}.ts`
    );
    const batches = splitBuildOptionsIntoBatches({
      entryPoints,
      outdir: 'dist',
      format: 'esm',
      metafile: true,
    } as BuildOptions);

    for (const batch of batches!) {
      expect(batch).toMatchObject({
        outdir: 'dist',
        format: 'esm',
        metafile: true,
      });
    }
  });
});

describe('mergeBuildResults', () => {
  it('merges errors, warnings, and metafile outputs from multiple results', () => {
    const a = buildResult({
      errors: [message('err-a')],
      warnings: [],
      metafile: {
        inputs: { 'a.ts': { bytes: 1, imports: [] } },
        outputs: { 'a.js': { bytes: 1, inputs: {}, imports: [], exports: [] } },
      },
    });
    const b = buildResult({
      errors: [],
      warnings: [message('warn-b')],
      metafile: {
        inputs: { 'b.ts': { bytes: 2, imports: [] } },
        outputs: { 'b.js': { bytes: 2, inputs: {}, imports: [], exports: [] } },
      },
    });

    const merged = mergeBuildResults([a, b]);
    expect(merged.errors).toHaveLength(1);
    expect(merged.warnings).toHaveLength(1);
    expect(merged.metafile?.inputs).toMatchObject({
      'a.ts': { bytes: 1 },
      'b.ts': { bytes: 2 },
    });
    expect(merged.metafile?.outputs).toMatchObject({
      'a.js': { bytes: 1 },
      'b.js': { bytes: 2 },
    });
  });

  it('leaves metafile, outputFiles and mangleCache undefined when absent', () => {
    const merged = mergeBuildResults([buildResult(), buildResult()]);
    expect(merged.metafile).toBeUndefined();
    expect(merged.outputFiles).toBeUndefined();
    expect(merged.mangleCache).toBeUndefined();
  });

  it('concatenates outputFiles and merges mangleCache', () => {
    const file = (path: string) =>
      ({ path, contents: new Uint8Array(), hash: '', text: '' }) as any;
    const merged = mergeBuildResults([
      buildResult({ outputFiles: [file('a.js')], mangleCache: { a: 'x' } }),
      buildResult({ outputFiles: [file('b.js')], mangleCache: { b: 'y' } }),
    ]);
    expect(merged.outputFiles!.map((f) => f.path)).toEqual(['a.js', 'b.js']);
    expect(merged.mangleCache).toEqual({ a: 'x', b: 'y' });
  });
});

describe('batchedBuild', () => {
  it('calls esbuild.build once when batching is not needed', async () => {
    const build = vi.fn(async () => buildResult());
    const options = {
      entryPoints: ['main.ts'],
    } as BuildOptions;

    await batchedBuild({ build }, options);

    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(options);
  });

  it('runs sequential builds and merges results when entry points exceed the batch size', async () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 2 },
      (_, i) => `file-${i}.ts`
    );
    const build = vi.fn(async (opts: BuildOptions) =>
      buildResult({
        metafile: {
          inputs: {
            [String((opts.entryPoints as string[])[0])]: {
              bytes: 1,
              imports: [],
            },
          },
          outputs: {},
        },
      })
    );

    const result = await batchedBuild({ build }, {
      entryPoints,
    } as BuildOptions);

    expect(build).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.metafile?.inputs ?? {})).toHaveLength(2);
  });

  it('runs batches sequentially and stops at the first failure', async () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE * 2 + 1 },
      (_, i) => `file-${i}.ts`
    );
    let running = 0;
    let maxRunning = 0;
    const build = vi.fn(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running--;
      if (build.mock.calls.length === 2) throw new Error('boom');
      return buildResult();
    });

    await expect(
      batchedBuild({ build }, { entryPoints } as BuildOptions)
    ).rejects.toThrow('boom');

    expect(maxRunning).toBe(1);
    expect(build).toHaveBeenCalledTimes(2);
  });

  describe('plugins', () => {
    const entryPoints = Array.from(
      { length: ENTRY_POINT_BATCH_SIZE + 1 },
      (_, i) => `file-${i}.ts`
    );

    // Runs each plugin's setup against a fake PluginBuild, like esbuild does per build.
    function createBuild(results: BuildResult[]) {
      const registered: Array<(r: BuildResult) => unknown>[] = [];
      const build = vi.fn(async (opts: BuildOptions) => {
        const callbacks: Array<(r: BuildResult) => unknown> = [];
        registered.push(callbacks);
        for (const plugin of opts.plugins ?? []) {
          await plugin.setup({
            onEnd: (cb: (r: BuildResult) => unknown) => callbacks.push(cb),
          } as unknown as PluginBuild);
        }
        return results[build.mock.calls.length - 1];
      });
      return { build, registered };
    }

    it('fires a plugin onEnd once with the merged result', async () => {
      const onEnd = vi.fn();
      const err = message('e');
      const { build } = createBuild([
        buildResult({ errors: [err] }),
        buildResult(),
      ]);

      const result = await batchedBuild({ build }, {
        entryPoints,
        plugins: [{ name: 'p', setup: (b: PluginBuild) => b.onEnd(onEnd) }],
      } as BuildOptions);

      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(onEnd).toHaveBeenCalledWith(result);
      expect(result.errors).toEqual([err]);
    });

    it('does not register onEnd callbacks on batches after the first', async () => {
      const { build, registered } = createBuild([buildResult(), buildResult()]);

      await batchedBuild({ build }, {
        entryPoints,
        plugins: [{ name: 'p', setup: (b: PluginBuild) => b.onEnd(vi.fn()) }],
      } as BuildOptions);

      expect(registered).toHaveLength(2);
      // The proxy swallows onEnd on later batches, so the fake build never sees it there.
      expect(registered[1]).toHaveLength(0);
    });

    it('runs setup once per batch and awaits onEnd callbacks in order', async () => {
      const order: string[] = [];
      const setup = vi.fn((b: PluginBuild) => {
        b.onEnd(async () => {
          await Promise.resolve();
          order.push('first');
        });
        b.onEnd(() => {
          order.push('second');
        });
      });
      const { build } = createBuild([buildResult(), buildResult()]);

      await batchedBuild({ build }, {
        entryPoints,
        plugins: [{ name: 'p', setup }],
      } as BuildOptions);

      expect(setup).toHaveBeenCalledTimes(2);
      expect(order).toEqual(['first', 'second']);
    });

    it('keeps plugin names so esbuild diagnostics stay readable', async () => {
      const { build } = createBuild([buildResult(), buildResult()]);

      await batchedBuild({ build }, {
        entryPoints,
        plugins: [{ name: 'my-plugin', setup: vi.fn() }],
      } as BuildOptions);

      for (const [opts] of build.mock.calls) {
        expect(opts.plugins!.map((p: Plugin) => p.name)).toEqual(['my-plugin']);
      }
    });
  });
});

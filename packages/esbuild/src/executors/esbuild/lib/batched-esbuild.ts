import type { BuildOptions, BuildResult, Plugin, PluginBuild } from 'esbuild';
import { rmSync } from 'fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'path';

/** Max entry points per esbuild invocation when batching (bounds memory use). */
export const ENTRY_POINT_BATCH_SIZE = 500;

type EsbuildModule = {
  build: (options: BuildOptions) => Promise<BuildResult>;
};

type EntryPoint = string | { in: string; out: string };

function entryPath(entry: EntryPoint): string {
  return typeof entry === 'string' ? entry : entry.in;
}

// esbuild derives outbase per call, so each batch must share the whole set's.
function getCommonOutbase(
  entryPoints: EntryPoint[],
  absWorkingDir: string
): string {
  const dirs = entryPoints.map((e) => {
    const p = entryPath(e);
    return dirname(isAbsolute(p) ? p : resolve(absWorkingDir, p)).split(sep);
  });
  const common = dirs.reduce((acc, parts) => {
    let i = 0;
    while (i < acc.length && i < parts.length && acc[i] === parts[i]) i++;
    return acc.slice(0, i);
  });
  return common.join(sep) || sep;
}

// Over-approximates the output path so entries that could collide share a batch,
// where esbuild reports the collision as it would in a single call.
function outputKey(
  entry: EntryPoint,
  outbase: string,
  absWorkingDir: string,
  entryNames = '[dir]/[name]'
): string {
  if (typeof entry !== 'string') return entry.out;
  const abs = isAbsolute(entry) ? entry : resolve(absWorkingDir, entry);
  return entryNames
    .replace(/\[dir\]/g, relative(outbase, dirname(abs)).split(sep).join('/'))
    .replace(/\[name\]/g, basename(abs, extname(abs)))
    .replace(/\[(hash|ext)\]/g, '');
}

export function splitBuildOptionsIntoBatches(
  options: BuildOptions,
  batchSize = ENTRY_POINT_BATCH_SIZE
): BuildOptions[] | null {
  const { entryPoints } = options;
  if (
    options.bundle ||
    !Array.isArray(entryPoints) ||
    entryPoints.length <= batchSize
  ) {
    return null;
  }
  const entries = entryPoints as EntryPoint[];
  const absWorkingDir = options.absWorkingDir ?? process.cwd();
  const outbase = options.outbase ?? getCommonOutbase(entries, absWorkingDir);

  const groups = new Map<string, EntryPoint[]>();
  for (const entry of entries) {
    const key = outputKey(entry, outbase, absWorkingDir, options.entryNames);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const batches: EntryPoint[][] = [[]];
  for (const group of groups.values()) {
    const current = batches[batches.length - 1];
    if (current.length > 0 && current.length + group.length > batchSize) {
      batches.push([...group]);
    } else {
      current.push(...group);
    }
  }
  return batches.map((batch) => ({
    ...options,
    outbase,
    entryPoints: batch as BuildOptions['entryPoints'],
  }));
}

export function mergeBuildResults(results: BuildResult[]): BuildResult {
  const hasMetafile = results.some((r) => r.metafile);
  return {
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings),
    outputFiles: results.some((r) => r.outputFiles)
      ? results.flatMap((r) => r.outputFiles ?? [])
      : undefined,
    metafile: hasMetafile
      ? {
          inputs: Object.assign({}, ...results.map((r) => r.metafile?.inputs)),
          outputs: Object.assign(
            {},
            ...results.map((r) => r.metafile?.outputs)
          ),
        }
      : undefined,
    mangleCache: results.some((r) => r.mangleCache)
      ? Object.assign({}, ...results.map((r) => r.mangleCache))
      : undefined,
  };
}

type EndCallback = Parameters<PluginBuild['onEnd']>[0];
type DisposeCallback = Parameters<PluginBuild['onDispose']>[0];

type BuildHooks = {
  onEnd: EndCallback[];
  onDispose: DisposeCallback[];
};

// A plugin's setup runs once per batch, but onStart, onEnd and onDispose should each
// fire once for the whole build, so only the first batch's registrations are kept.
function withBuildScopedHooks(
  plugins: Plugin[],
  hooks: BuildHooks,
  batchIndex: number
): Plugin[] {
  const isFirst = batchIndex === 0;
  return plugins.map((plugin) => ({
    name: plugin.name,
    setup(build) {
      const proxy: PluginBuild = Object.create(build);
      proxy.onStart = (callback) => {
        if (isFirst) build.onStart(callback);
      };
      proxy.onEnd = (callback) => {
        if (isFirst) hooks.onEnd.push(callback);
      };
      proxy.onDispose = (callback) => {
        if (isFirst) hooks.onDispose.push(callback);
      };
      return plugin.setup(proxy);
    },
  }));
}

function outputPaths(result: BuildResult, absWorkingDir: string): string[] {
  return Object.keys(result.metafile?.outputs ?? {}).map((p) =>
    resolve(absWorkingDir, p)
  );
}

export async function batchedBuild(
  esbuild: EsbuildModule,
  options: BuildOptions
): Promise<BuildResult> {
  const batches = splitBuildOptionsIntoBatches(options);
  if (!batches) {
    return esbuild.build(options);
  }
  const absWorkingDir = options.absWorkingDir ?? process.cwd();
  const hooks: BuildHooks = { onEnd: [], onDispose: [] };
  const results: BuildResult[] = [];

  const finish = async (merged: BuildResult) => {
    if (!options.metafile) delete merged.metafile;
    try {
      for (const callback of hooks.onEnd) await callback(merged);
    } finally {
      for (const callback of hooks.onDispose) callback();
    }
    return merged;
  };

  try {
    for (const [index, batch] of batches.entries()) {
      results.push(
        await esbuild.build({
          ...batch,
          // Records what each batch wrote, so a later failure can remove it.
          metafile: true,
          plugins: withBuildScopedHooks(batch.plugins ?? [], hooks, index),
        })
      );
    }
  } catch (error) {
    const failure = error as Partial<BuildResult> | undefined;
    // A single failed esbuild call writes nothing, so earlier batches' output goes too.
    if (options.write !== false) {
      for (const file of results.flatMap((r) =>
        outputPaths(r, absWorkingDir)
      )) {
        rmSync(file, { force: true });
      }
    }
    await finish(
      mergeBuildResults([
        ...results,
        { errors: failure?.errors ?? [], warnings: failure?.warnings ?? [] },
      ] as BuildResult[])
    );
    throw error;
  }
  return finish(mergeBuildResults(results));
}

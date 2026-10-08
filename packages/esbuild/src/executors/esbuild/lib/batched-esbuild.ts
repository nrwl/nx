import type { BuildOptions, BuildResult, Plugin, PluginBuild } from 'esbuild';
import { dirname, isAbsolute, resolve, sep } from 'path';

/** Max entry points per esbuild invocation when batching (bounds memory use). */
export const ENTRY_POINT_BATCH_SIZE = 500;

type EsbuildModule = {
  build: (options: BuildOptions) => Promise<BuildResult>;
};

function entryPath(entry: string | { in: string; out: string }): string {
  return typeof entry === 'string' ? entry : entry.in;
}

// esbuild derives outbase per call, so each batch must share the whole set's.
function getCommonOutbase(
  entryPoints: (string | { in: string; out: string })[],
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
  const outbase =
    options.outbase ??
    getCommonOutbase(
      entryPoints as (string | { in: string; out: string })[],
      options.absWorkingDir ?? process.cwd()
    );
  const batches: BuildOptions[] = [];
  for (let i = 0; i < entryPoints.length; i += batchSize) {
    batches.push({
      ...options,
      outbase,
      entryPoints: entryPoints.slice(
        i,
        i + batchSize
      ) as BuildOptions['entryPoints'],
    });
  }
  return batches;
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

// A plugin's setup runs once per batch, but its onEnd should fire once with the merged result.
function withMergedOnEnd(
  plugins: Plugin[],
  endCallbacks: EndCallback[],
  batchIndex: number
): Plugin[] {
  return plugins.map((plugin) => ({
    name: plugin.name,
    setup(build) {
      const proxy: PluginBuild = Object.create(build);
      proxy.onEnd = (callback) => {
        if (batchIndex === 0) endCallbacks.push(callback);
      };
      return plugin.setup(proxy);
    },
  }));
}

export async function batchedBuild(
  esbuild: EsbuildModule,
  options: BuildOptions
): Promise<BuildResult> {
  const batches = splitBuildOptionsIntoBatches(options);
  if (!batches) {
    return esbuild.build(options);
  }
  const endCallbacks: EndCallback[] = [];
  const results: BuildResult[] = [];
  for (const [index, batch] of batches.entries()) {
    results.push(
      await esbuild.build({
        ...batch,
        plugins: withMergedOnEnd(batch.plugins ?? [], endCallbacks, index),
      })
    );
  }
  const merged = mergeBuildResults(results);
  for (const callback of endCallbacks) {
    await callback(merged);
  }
  return merged;
}

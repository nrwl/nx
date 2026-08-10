import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger, workspaceRoot, ProjectConfiguration } from '@nx/devkit';
import {
  hashWithWorkspaceContext,
  workspaceDataDirectory,
  hashObject,
  hashFile,
  hashArray,
  PluginCache,
} from '@nx/devkit/internal';

export interface AnalysisSuccessResult {
  // Maps project file path -> node configuration
  nodesByFile: Record<string, ProjectConfiguration>;
  // Maps project root -> referenced project roots
  referencesByRoot: Record<
    string,
    { refs: string[]; sourceConfigFile: string }
  >;
  /**
   * Project roots whose targets were derived from C# sources rather than from
   * project files alone — i.e. projects that produced atomized test targets.
   *
   * Absent (not empty) when nothing atomized, both so that output from an older
   * analyzer still parses and so the common case is trivially detectable.
   */
  atomizedRoots?: string[];
  /**
   * Workspace-relative paths of sources that fed discovery but sit outside their
   * project's directory — linked or shared files.
   *
   * `atomizedRoots` is hashed as a per-root glob, which by construction cannot
   * reach these, so they are hashed alongside it.
   */
  atomizedExternalSources?: string[];
}
export interface AnalysisErrorResult {
  error: Error;
}
export type AnalysisResult = AnalysisSuccessResult | AnalysisErrorResult;

/**
 * Options passed to the MSBuild analyzer.
 * These are the target names that the analyzer will use to generate targets.
 */
export interface DotNetAnalyzerOptions {
  buildTargetName?: string;
  testTargetName?: string;
  cleanTargetName?: string;
  restoreTargetName?: string;
  publishTargetName?: string;
  packTargetName?: string;
  /**
   * Name of the atomized parent target. Undefined disables test splitting
   * entirely, which is the default.
   */
  testCiTargetName?: string;
  /** Pre-derived group name; the analyzer does not compute one. */
  testCiGroupName?: string;
  testCiSplitBy?: 'class' | 'method';
}

/**
 * A cached analysis plus the hash of the C# sources it was derived from.
 *
 * `sourceHash` is null whenever nothing atomized, which is both the common case
 * and the cheap one: no glob hashing is performed on write or on read.
 */
interface CachedAnalysis {
  result: AnalysisSuccessResult;
  sourceHash: string | null;
}

interface AnalyzerCache {
  hash: string;
  /**
   * Hash of the options the analysis was produced with.
   *
   * The on-disk cache gets this from its per-options filename, but the
   * in-memory one is a single slot shared by every call in the process, and a
   * workspace that registers `@nx/dotnet` more than once calls in with
   * different options.
   */
  optionsHash: string;
  result: AnalysisResult;
  sourceHash: string | null;
}

let cache: AnalyzerCache | null = null;

/**
 * Get the path to the msbuild-analyzer executable
 */
function getAnalyzerPath(): string {
  const executableName = 'MsbuildAnalyzer.dll';

  const possiblePaths = [
    // When running from dist/packages/dotnet
    join(__dirname, '..', 'lib', executableName),
    // When running from packages/dotnet/src (development)
    join(__dirname, 'lib', executableName),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `msbuild-analyzer not found at any expected location. Please build it first with: nx run dotnet:copy-assets`
  );
}

/**
 * Hash every file that affects MSBuild evaluation — project files plus the Directory.*
 * matches surfaced by the createNodesV2 glob. The analyzer partitions the same list on
 * its side, so we don't classify it here.
 */
async function calculateProjectFilesHash(files: string[]): Promise<string> {
  return await hashWithWorkspaceContext(workspaceRoot, files);
}

/**
 * Joins a project root and a glob pattern, the way `{projectRoot}` inputs are
 * expanded for ordinary task hashing.
 */
function rootGlob(root: string, pattern: string): string {
  const combined = `${root}/${pattern}`;
  // Same problem Nx's own {projectRoot} substitution hits in task-hasher.ts:
  // a workspace-root project's root is ".", and "./**" matches nothing.
  return combined.startsWith('./') ? combined.slice(2) : combined;
}

/**
 * Hash the C# sources of every project that produced atomized targets.
 *
 * Atomized targets are derived from the test classes and methods declared in a
 * project's sources, but `calculateProjectFilesHash` only covers project files.
 * Without this, adding or removing a test would leave the cached analysis in
 * place and the new test would silently never get a target.
 *
 * Returns null when nothing atomized, which skips the work entirely — the point
 * being that a workspace which never opts in pays nothing for this.
 *
 * All roots go into a single glob group on purpose. The underlying native
 * implementation walks the whole file list once per group, so grouping per
 * project root would make this O(roots x files) instead of O(files).
 */
async function computeSourceHash(
  result: AnalysisSuccessResult
): Promise<string | null> {
  if (!result.atomizedRoots?.length) {
    return null;
  }

  const rootsHash = await hashWithWorkspaceContext(
    workspaceRoot,
    result.atomizedRoots.map((root) => rootGlob(root, '**/*.cs'))
  );

  // Discovery reads MSBuild's Compile items, which can point outside the
  // project. A linked test file would otherwise change the discovered units
  // without changing this hash. Hashed by exact path rather than folded into
  // the glob group above: these are literal paths, not patterns, and one
  // containing a glob metacharacter (*, !, {, ...) would silently change
  // which files the group matches.
  const externalHashes = (result.atomizedExternalSources ?? []).map(
    (relativePath) => hashFile(join(workspaceRoot, relativePath)) ?? ''
  );

  return externalHashes.length === 0
    ? rootsHash
    : hashArray([rootsHash, ...externalHashes]);
}

/**
 * Whether a cached analysis still reflects what is on disk.
 *
 * A null `sourceHash` means the analysis did not depend on C# sources, so the
 * project-files hash the entry is keyed by is already sufficient.
 */
async function isSourceHashCurrent(
  sourceHash: string | null,
  result: AnalysisSuccessResult
): Promise<boolean> {
  if (sourceHash === null) {
    return true;
  }

  return sourceHash === (await computeSourceHash(result));
}

/**
 * Run the msbuild-analyzer and return the results.
 * Uses stdin for large file lists to avoid ARG_MAX issues.
 */
function runAnalyzer(
  files: string[],
  options?: DotNetAnalyzerOptions
): AnalysisSuccessResult {
  if (files.length === 0) {
    return { nodesByFile: {}, referencesByRoot: {} };
  }

  const analyzerPath = getAnalyzerPath();

  // Set environment variables for the analyzer process
  const env = { ...process.env };

  // TODO(@AgentEnder): Remove this if anyone reports issues with being unable
  // to locate the .NET runtime, currently I'm not hitting the issue but when I was
  // this solved it, and it took a deal of effort to track down so I'm leaving it here commented for now.
  // In Nx 23, if no one has reported the issue, its probably safe to remove.
  //
  // On macOS/Linux, set library path to help find libhostfxr.dylib
  // if (process.platform === 'darwin' || process.platform === 'linux') {
  //   const dotnetRoot = process.env.DOTNET_ROOT || '/usr/local/share/dotnet';
  //   const hostFxrPath = join(dotnetRoot, 'host', 'fxr');

  //   if (existsSync(hostFxrPath)) {
  //     const versions = readdirSync(hostFxrPath);
  //     if (versions.length > 0) {
  //       // Use the latest version
  //       const latestVersion = versions.sort().reverse()[0];
  //       const fxrDir = join(hostFxrPath, latestVersion);

  //       const envVar =
  //         process.platform === 'darwin'
  //           ? 'DYLD_FALLBACK_LIBRARY_PATH'
  //           : 'LD_LIBRARY_PATH';
  //       const currentValue = env[envVar];
  //       env[envVar] = currentValue ? `${fxrDir}:${currentValue}` : fxrDir;
  //     }
  //   }
  // }

  try {
    let output: string;

    // Prepare CLI arguments
    const args = [analyzerPath, workspaceRoot];

    // Add plugin options as JSON string if provided
    if (options) {
      args.push(JSON.stringify(options));
    }

    // Use stdin mode for large file lists to avoid ARG_MAX issues. The analyzer
    // partitions paths by filename, so we just stream everything in one block.
    const input = files.join('\n');
    const result = spawnSync('dotnet', args, {
      input,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      windowsHide: true,
      env,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        `Analyzer exited with code ${result.status}: ${result.stderr}`
      );
    }

    // Output stderr (includes performance logs when NX_PERF_LOGGING=true)
    if (result.stderr) {
      console.error(result.stderr);
    }

    output = result.stdout;

    return JSON.parse(output) as AnalysisSuccessResult;
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    if (err.stderr) {
      logger.error(`msbuild-analyzer error: ${err.stderr}`);
    }
    throw new Error(
      `Failed to run msbuild-analyzer: ${err.message}${
        err.stderr ? `\n${err.stderr}` : ''
      }`
    );
  }
}

/**
 * Get project analysis results for the given project files.
 * Results are cached based on the content hash of all project files.
 * This should be called by createNodes to populate the cache.
 */
export async function analyzeProjects(
  files: string[],
  options?: DotNetAnalyzerOptions
): Promise<AnalysisResult> {
  const filesHash = await calculateProjectFilesHash(files);
  const optionsHash = hashObject(options);

  // Return cached results if the hash matches
  if (
    cache &&
    cache.hash === filesHash &&
    cache.optionsHash === optionsHash &&
    // NOTE: We don't read from the cache here if it's an error result,
    // to allow retrying analysis in case of transient errors or errors fixed
    // that may not be reflected in the hash (like setting an env var).
    isAnalysisSuccessResult(cache.result) &&
    (await isSourceHashCurrent(cache.sourceHash, cache.result))
  ) {
    return cache.result;
  }

  // The `-v2` marks the cache *value* shape, which now wraps the analysis
  // alongside the hash of the sources it came from. Entries written by an
  // earlier version live under the old name and are simply never read.
  const analyzerCache = new PluginCache<CachedAnalysis>(
    join(workspaceDataDirectory, `dotnet-v2-${optionsHash}.hash`)
  );
  const cachedEntry = analyzerCache.get(filesHash);
  if (
    cachedEntry?.result &&
    (await isSourceHashCurrent(cachedEntry.sourceHash, cachedEntry.result))
  ) {
    // Update cache
    cache = {
      hash: filesHash,
      optionsHash,
      result: cachedEntry.result,
      sourceHash: cachedEntry.sourceHash,
    };
    return cachedEntry.result;
  }

  // Run the analyzer
  try {
    const result = runAnalyzer(files, options);
    const sourceHash = await computeSourceHash(result);

    // Update local cache
    cache = {
      hash: filesHash,
      optionsHash,
      result,
      sourceHash,
    };
    // Update persistent cache
    analyzerCache.set(filesHash, { result, sourceHash });
    analyzerCache.writeToDisk();

    return result;
  } catch (error) {
    const err = error as Error;
    // We save the error result in the local cache to avoid getting
    // a different error when reading the cached result to createDependencies.
    // Instead, we'll find a cached error and know that it was printed earlier.
    // We DO NOT save error results to the on-disk cache to allow retries without
    // running `nx reset`
    const errorResult: AnalysisErrorResult = {
      error: err,
    };
    cache = {
      hash: filesHash,
      optionsHash,
      result: errorResult,
      sourceHash: null,
    };
    return errorResult;
  }
}

/**
 * Read the cached analysis results without running the analyzer.
 * This should be called by createDependencies, which always runs after createNodes.
 * If the cache is empty, returns an empty result (this shouldn't happen in normal operation).
 */
export function readCachedAnalysisResult(): AnalysisResult {
  if (cache) {
    return cache.result;
  }

  // This shouldn't happen since createNodes always runs first
  throw new Error(
    'Analysis result cache is empty. Ensure that analyzeProjects() is called before readCachedAnalysisResult().'
  );
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  cache = null;
}

export function isAnalysisErrorResult(
  result: AnalysisResult
): result is AnalysisErrorResult {
  return 'error' in result;
}

export function isAnalysisSuccessResult(
  result: AnalysisResult
): result is AnalysisSuccessResult {
  return !('error' in result);
}

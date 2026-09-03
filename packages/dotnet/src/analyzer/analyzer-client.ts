import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  logger,
  parseJson,
  workspaceRoot,
  ProjectConfiguration,
} from '@nx/devkit';
import {
  hashWithWorkspaceContext,
  workspaceDataDirectory,
  hashObject,
  isCI,
  killChildOnHostExit,
  killProcessTreeGraceful,
  PluginCache,
  safeSpawn,
} from '@nx/devkit/internal';

const DEFAULT_ANALYSIS_TIMEOUT_SECONDS = isCI() ? 600 : 120;
// setTimeout silently clamps a delay past the 32-bit signed max to 1ms, which
// would abort immediately — the opposite of what a large value asks for.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// Thrown when a newer analysis supersedes an in-flight one. Callers swallow it
// rather than surfacing an internal string to the user.
export const ANALYZER_CANCELLED_MESSAGE = 'Analyzer run was cancelled';

let currentAbortController: AbortController | undefined;

/**
 * Cancel any in-flight analyzer process. Safe to call even if nothing is running.
 */
export function cancelPendingAnalysis(): void {
  if (currentAbortController) {
    currentAbortController.abort('cancelled');
    currentAbortController = undefined;
  }
}

export function getAnalysisTimeoutMs(): number {
  const envTimeout = process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT;
  if (envTimeout) {
    const parsed = Number(envTimeout);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.min(parsed * 1000, MAX_TIMEOUT_MS);
    }
  }
  return DEFAULT_ANALYSIS_TIMEOUT_SECONDS * 1000;
}

export interface AnalysisSuccessResult {
  // Maps project file path -> node configuration
  nodesByFile: Record<string, ProjectConfiguration>;
  // Maps project root -> referenced project roots
  referencesByRoot: Record<
    string,
    { refs: string[]; sourceConfigFile: string }
  >;
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
}

interface AnalyzerCache {
  hash: string;
  result: AnalysisResult;
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
 * Run the msbuild-analyzer and return the results.
 * Uses stdin for large file lists to avoid ARG_MAX issues.
 */
async function runAnalyzer(
  files: string[],
  options?: DotNetAnalyzerOptions
): Promise<AnalysisSuccessResult> {
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

  // Nothing here may contain a double quote: on Windows `safeSpawn` routes a bare binary
  // name through cmd.exe, whose quoting cannot express one, so it refuses the argument.
  // That is why the options JSON goes over stdin instead (see below).
  const args = [analyzerPath, workspaceRoot];

  // Cancel any in-flight analyzer from a previous call, then create a fresh controller.
  cancelPendingAnalysis();
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  const timeoutMs = getAnalysisTimeoutMs();
  const timeoutSeconds = timeoutMs / 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let stdout = '';
  let stderr = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const child = safeSpawn('dotnet', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env,
      });
      // A plugin worker torn down by `nx reset` would otherwise orphan the analyzer.
      killChildOnHostExit(child);

      // On abort, kill the process tree and settle immediately — a wedged
      // process that outlives the kill signal would otherwise keep this
      // promise pending and the abort error would never surface.
      const onAbort = () => {
        if (child.pid) {
          killProcessTreeGraceful(child.pid).catch(() => {});
        }
        reject(new Error('Analyzer aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      child.stdout?.setEncoding('utf-8');
      child.stderr?.setEncoding('utf-8');
      child.stdout?.on('data', (data) => {
        stdout += data;
      });
      child.stderr?.on('data', (data) => {
        stderr += data;
      });

      child.on('error', (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Analyzer exited with code ${code}: ${stderr}`));
        }
      });

      // Stream the options JSON, then the file list, over stdin. The first line is
      // always written, empty when there are no options, so the analyzer never has to
      // infer whether one was sent. The analyzer partitions paths by filename, so we
      // just send everything in one block.
      // EPIPE if the analyzer dies early. Surfaced via `close` only when the
      // child also exits non-zero; a stdin error with a clean exit means the
      // analyzer read a truncated file list.
      child.stdin?.on('error', () => {});
      child.stdin?.end(
        [options ? JSON.stringify(options) : '', ...files].join('\n')
      );
    });
  } catch (error) {
    if (signal.reason === 'cancelled') {
      throw new Error(ANALYZER_CANCELLED_MESSAGE);
    }
    if (signal.aborted) {
      throw new Error(
        `msbuild-analyzer timed out after ${timeoutSeconds} ${timeoutSeconds === 1 ? 'second' : 'seconds'}.\n` +
          `  1. Set the environment variable NX_DOTNET_PROJECT_GRAPH_TIMEOUT to a higher value (in seconds) to increase the timeout.\n` +
          `  2. If the issue persists, set NX_DOTNET_DISABLE=true to disable the .NET plugin entirely.`
      );
    }
    const err = error as { stderr?: string; message: string };
    const stderrAlreadyInMessage = err.message.includes(stderr);
    if (stderr && !stderrAlreadyInMessage) {
      logger.error(`msbuild-analyzer error: ${stderr}`);
    }
    throw new Error(
      `Failed to run msbuild-analyzer: ${err.message}${
        stderr && !stderrAlreadyInMessage ? `\n${stderr}` : ''
      }`
    );
  } finally {
    clearTimeout(timer);
    // Drop the settled controller so a later cancelPendingAnalysis() cannot
    // abort a run that already finished.
    if (currentAbortController === controller) {
      currentAbortController = undefined;
    }
  }

  // Output stderr (includes performance logs when NX_PERF_LOGGING=true)
  if (stderr) {
    console.error(stderr);
  }

  try {
    // parseJson over JSON.parse: on malformed output it reports line:column with
    // a code frame, where JSON.parse gives only a character offset.
    return parseJson<AnalysisSuccessResult>(stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse msbuild-analyzer output: ${(error as Error).message}`
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

  // Return cached results if the hash matches
  if (
    cache &&
    cache.hash === filesHash &&
    // NOTE: We don't read from the cache here if it's an error result,
    // to allow retrying analysis in case of transient errors or errors fixed
    // that may not be reflected in the hash (like setting an env var).
    isAnalysisSuccessResult(cache.result)
  ) {
    return cache.result;
  }

  const optionsHash = hashObject(options);
  const analyzerCache = new PluginCache<AnalysisSuccessResult>(
    join(workspaceDataDirectory, `dotnet-${optionsHash}.hash`)
  );
  const cachedResult = analyzerCache.get(filesHash);
  if (cachedResult) {
    // Update cache
    cache = {
      hash: filesHash,
      result: cachedResult,
    };
    return cachedResult;
  }

  // Run the analyzer
  try {
    const result = await runAnalyzer(files, options);

    // Update local cache
    cache = {
      hash: filesHash,
      result,
    };
    // Update persistent cache
    analyzerCache.set(filesHash, result);
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
    // A superseded run is not a result: caching it would hand the sentinel to
    // createDependencies via readCachedAnalysisResult().
    if (err.message !== ANALYZER_CANCELLED_MESSAGE) {
      cache = {
        hash: filesHash,
        result: errorResult,
      };
    }
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

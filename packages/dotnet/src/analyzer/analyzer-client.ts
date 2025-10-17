import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  logger,
  workspaceRoot,
  ProjectConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';

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

const analyzerCaches = new Map<string, Record<string, AnalysisSuccessResult>>();

function getCachePathForOptionsHash(optionsHash: string): string {
  return join(workspaceDataDirectory, `dotnet-${optionsHash}.hash`);
}

function readAnalyzerCache(
  optionsHash: string
): Record<string, AnalysisSuccessResult> {
  if (analyzerCaches.has(optionsHash)) {
    return analyzerCaches.get(optionsHash)!;
  }
  const cacheFilePath = getCachePathForOptionsHash(optionsHash);
  try {
    return JSON.parse(readFileSync(cacheFilePath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAnalyzerCache(
  optionsHash: string,
  cache: Record<string, AnalysisSuccessResult>
): void {
  analyzerCaches.set(optionsHash, cache);
  const cacheFilePath = getCachePathForOptionsHash(optionsHash);
  const cacheDir = dirname(cacheFilePath);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  try {
    writeJsonFile(cacheFilePath, cache);
  } catch (error) {
    logger.warn(
      `Failed to write .NET analyzer cache to ${cacheFilePath}: ${
        (error as Error).message
      }`
    );
  }
}

export interface DotNetPluginOptions {
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
    `msbuild-analyzer not found at any expected location. Please build it first with: nx run dotnet:build-analyzer`
  );
}

/**
 * Calculate a hash of all project files and Directory.Build.* files to determine if we need to re-analyze
 */
async function calculateProjectFilesHash(
  projectFiles: string[]
): Promise<string> {
  const hash = await hashWithWorkspaceContext(
    workspaceRoot,
    projectFiles.concat('Directory.Build.*', '**/Directory.Build.*')
  );

  return hash;
}

/**
 * Run the msbuild-analyzer and return the results.
 * Uses stdin for large file lists to avoid ARG_MAX issues.
 */
function runAnalyzer(
  projectFiles: string[],
  options?: DotNetPluginOptions
): AnalysisSuccessResult {
  if (projectFiles.length === 0) {
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

    // Use stdin mode for large file lists to avoid ARG_MAX issues
    const input = projectFiles.join('\n');
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
  projectFiles: string[],
  options?: DotNetPluginOptions
): Promise<AnalysisResult> {
  const filesHash = await calculateProjectFilesHash(projectFiles);

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
  const analyzerCache = readAnalyzerCache(optionsHash);
  const cachedResult = analyzerCache[filesHash];
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
    const result = runAnalyzer(projectFiles, options);

    // Update local cache
    cache = {
      hash: filesHash,
      result,
    };
    // Update persistent cache
    writeAnalyzerCache(optionsHash, {
      ...analyzerCache,
      [filesHash]: result,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    // We save the error result in the local cache to avoid getting
    // a different error when reading the cached result to createDependencies.
    // Instead, we'll find a cached error and know that it was printed earlier.
    // We DO NOT save error results to the on-disk cache to allow retries without
    // running `nx reset`.
    const errorResult: AnalysisResult = {
      nodesByFile: {},
      referencesByRoot: {},
      error: err,
    };
    cache = {
      hash: filesHash,
      result: errorResult,
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

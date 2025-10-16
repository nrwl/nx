import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { logger, workspaceRoot, ProjectConfiguration } from '@nx/devkit';
import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';

export interface AnalysisResult {
  // Maps project file path -> node configuration
  nodesByFile: Record<string, ProjectConfiguration>;
  // Maps project root -> referenced project roots
  referencesByRoot: Record<
    string,
    { refs: string[]; sourceConfigFile: string }
  >;
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
 * Estimate the command line length for all project files.
 * ARG_MAX is typically 128KB-2MB on modern systems, but we'll be conservative.
 */
function shouldUseStdin(projectFiles: string[]): boolean {
  // Use stdin if we have more than 100 files, or if the total length exceeds 50KB
  if (projectFiles.length > 100) {
    return true;
  }

  const totalLength = projectFiles.reduce((sum, f) => sum + f.length, 0);
  return totalLength > 50 * 1024;
}

/**
 * Run the msbuild-analyzer and return the results.
 * Uses stdin for large file lists to avoid ARG_MAX issues.
 */
function runAnalyzer(projectFiles: string[]): AnalysisResult {
  if (projectFiles.length === 0) {
    return { nodesByFile: {}, referencesByRoot: {} };
  }

  const analyzerPath = getAnalyzerPath();

  // Set environment variables for the analyzer process
  const env = { ...process.env };

  // On macOS/Linux, set library path to help find libhostfxr.dylib
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const dotnetRoot = process.env.DOTNET_ROOT || '/usr/local/share/dotnet';
    const hostFxrPath = join(dotnetRoot, 'host', 'fxr');

    if (existsSync(hostFxrPath)) {
      const versions = readdirSync(hostFxrPath);
      if (versions.length > 0) {
        // Use the latest version
        const latestVersion = versions.sort().reverse()[0];
        const fxrDir = join(hostFxrPath, latestVersion);

        const envVar =
          process.platform === 'darwin'
            ? 'DYLD_FALLBACK_LIBRARY_PATH'
            : 'LD_LIBRARY_PATH';
        const currentValue = env[envVar];
        env[envVar] = currentValue ? `${fxrDir}:${currentValue}` : fxrDir;
      }
    }
  }

  try {
    let output: string;

    // Use stdin mode for large file lists to avoid ARG_MAX issues
    const input = projectFiles.join('\n');
    const result = spawnSync('dotnet', [analyzerPath, workspaceRoot], {
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

    return JSON.parse(output) as AnalysisResult;
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
  projectFiles: string[]
): Promise<AnalysisResult> {
  const hash = await calculateProjectFilesHash(projectFiles);

  // Return cached results if the hash matches
  if (cache && cache.hash === hash) {
    return cache.result;
  }

  // Run the analyzer
  const result = runAnalyzer(projectFiles);

  // Update cache
  cache = {
    hash,
    result,
  };

  return result;
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

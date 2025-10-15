import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { logger, workspaceRoot } from '@nx/devkit';

export interface ProjectAnalysis {
    path: string;
    evaluatedProperties: Record<string, string>;
    packageReferences: Array<{
        Include: string;
        Version?: string;
    }>;
    projectReferences: string[];
    error?: string;
}

interface AnalyzerCache {
    hash: string;
    results: Map<string, ProjectAnalysis>;
}

let cache: AnalyzerCache | null = null;

/**
 * Get the path to the msbuild-analyzer executable
 */
function getAnalyzerPath(): string {
    // The analyzer is built to src/lib/MsbuildAnalyzer (or MsbuildAnalyzer.exe on Windows)
    const executableName =
        process.platform === 'win32' ? 'MsbuildAnalyzer.exe' : 'MsbuildAnalyzer';

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
        `msbuild-analyzer not found at any expected location. Please build it first with: dotnet publish packages/dotnet/analyzer/MsbuildAnalyzer.csproj`
    );
}

/**
 * Calculate a hash of all project files to determine if we need to re-analyze
 */
function calculateProjectFilesHash(projectFiles: string[]): string {
    const hash = createHash('sha256');

    // Sort files to ensure consistent ordering
    const sortedFiles = [...projectFiles].sort();

    for (const file of sortedFiles) {
        const fullPath = join(workspaceRoot, file);
        if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, 'utf-8');
            hash.update(file);
            hash.update(content);
        }
    }

    return hash.digest('hex');
}

/**
 * Run the msbuild-analyzer and return the results
 */
function runAnalyzer(projectFiles: string[]): ProjectAnalysis[] {
    if (projectFiles.length === 0) {
        return [];
    }

    const analyzerPath = getAnalyzerPath();

    // Convert relative paths to absolute paths for the analyzer
    const absolutePaths = projectFiles.map((f) => join(workspaceRoot, f));

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
                env[envVar] = currentValue
                    ? `${fxrDir}:${currentValue}`
                    : fxrDir;
            }
        }
    }

    try {
        const output = execFileSync(analyzerPath, absolutePaths, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env,
        });

        return JSON.parse(output) as ProjectAnalysis[];
    } catch (error) {
        const err = error as { stderr?: string; message: string };
        if (err.stderr) {
            logger.error(`msbuild-analyzer error: ${err.stderr}`);
        }
        throw new Error(
            `Failed to run msbuild-analyzer: ${err.message}${err.stderr ? `\n${err.stderr}` : ''}`
        );
    }
}

/**
 * Get project analysis results for the given project files.
 * Results are cached based on the content hash of all project files.
 */
export function analyzeProjects(
    projectFiles: string[]
): Map<string, ProjectAnalysis> {
    const hash = calculateProjectFilesHash(projectFiles);

    // Return cached results if the hash matches
    if (cache && cache.hash === hash) {
        return cache.results;
    }

    // Run the analyzer
    const results = runAnalyzer(projectFiles);

    // Build a map keyed by relative path for easy lookup
    const resultsMap = new Map<string, ProjectAnalysis>();
    for (const result of results) {
        const relativePath = relative(workspaceRoot, result.path);
        resultsMap.set(relativePath, result);
    }

    // Update cache
    cache = {
        hash,
        results: resultsMap,
    };

    return resultsMap;
}

/**
 * Get analysis for a single project file.
 * This will use the cached results if available.
 */
export function getProjectAnalysis(
    projectFile: string,
    allProjectFiles?: string[]
): ProjectAnalysis | undefined {
    // If we have cached results, try to find it there first
    if (cache) {
        const analysis = cache.results.get(projectFile);
        if (analysis) {
            return analysis;
        }
    }

    // If we have all project files, analyze them all at once
    if (allProjectFiles && allProjectFiles.length > 0) {
        const results = analyzeProjects(allProjectFiles);
        return results.get(projectFile);
    }

    // Otherwise, analyze just this one file
    const results = analyzeProjects([projectFile]);
    return results.get(projectFile);
}

/**
 * Resolve a project reference path to an absolute path
 */
export function resolveProjectReference(
    reference: string,
    sourceFile: string
): string {
    const sourceDir = dirname(join(workspaceRoot, sourceFile));
    const absolutePath = resolve(sourceDir, reference);
    return relative(workspaceRoot, absolutePath);
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
    cache = null;
}

/**
 * Check if a project is a test project based on analyzer results
 */
export function isTestProject(analysis: ProjectAnalysis): boolean {
    // Check the IsTestProject property first
    if (analysis.evaluatedProperties['IsTestProject'] === 'true') {
        return true;
    }

    // Fallback: check for test packages
    const testPackages = [
        'Microsoft.NET.Test.Sdk',
        'xunit',
        'xunit.runner.visualstudio',
        'MSTest.TestAdapter',
        'MSTest.TestFramework',
        'NUnit',
        'NUnit3TestAdapter',
    ];

    return analysis.packageReferences.some((pkg) =>
        testPackages.some((testPkg) => pkg.Include.includes(testPkg))
    );
}

/**
 * Check if a project is executable based on analyzer results
 */
export function isExecutable(analysis: ProjectAnalysis): boolean {
    const outputType = analysis.evaluatedProperties['OutputType'];
    return outputType?.toLowerCase() === 'exe';
}

/**
 * Get the project type from file extension
 */
export function getProjectType(
    projectFile: string
): 'csharp' | 'fsharp' | 'vb' {
    const ext = projectFile.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'fsproj':
            return 'fsharp';
        case 'vbproj':
            return 'vb';
        default:
            return 'csharp';
    }
}

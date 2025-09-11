import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { workspaceRoot } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenPluginOptions, MavenAnalysisData } from './types';
/**
 * Detect Maven executable: mvnd > mvnw > mvn
 */
function detectMavenExecutable(): string {
  console.log(`[Maven Analyzer] Detecting Maven executable in workspace: ${workspaceRoot}`);

  // First priority: Check for Maven Daemon
  try {
    const { execSync } = require('child_process');
    execSync('mvnd --version', { stdio: 'pipe' });
    console.log(`[Maven Analyzer] Found Maven Daemon, using: mvnd`);
    return 'mvnd';
  } catch (error) {
    console.log(`[Maven Analyzer] Maven Daemon not available`);
  }

  // Second priority: Check for Maven wrapper
  if (process.platform === 'win32') {
    const wrapperPath = join(workspaceRoot, 'mvnw.cmd');
    if (existsSync(wrapperPath)) {
      console.log(`[Maven Analyzer] Found Maven wrapper, using: mvnw.cmd`);
      return 'mvnw.cmd';
    }
  } else {
    const wrapperPath = join(workspaceRoot, 'mvnw');
    if (existsSync(wrapperPath)) {
      console.log(`[Maven Analyzer] Found Maven wrapper, using: ./mvnw`);
      return './mvnw';
    }
  }

  // Fallback: Use regular Maven
  console.log(`[Maven Analyzer] Using fallback: mvn`);
  return 'mvn';
}

/**
 * Run Maven analysis using our Kotlin analyzer plugin
 */
export async function runMavenAnalysis(options: MavenPluginOptions): Promise<MavenAnalysisData> {
  console.log(`[Maven Analyzer] Starting analysis with options:`, options);

  const outputFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const isVerbose = options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';

  console.log(`[Maven Analyzer] Output file: ${outputFile}`);
  console.log(`[Maven Analyzer] Verbose mode: ${isVerbose}`);
  console.log(`[Maven Analyzer] Workspace data directory: ${workspaceDataDirectory}`);

  // Detect Maven executable (mvnw > mvn)
  const mavenExecutable = detectMavenExecutable();

  const mavenArgs = [
    'dev.nx.maven:nx-maven-analyzer-plugin:4.1.0-SNAPSHOT:analyze',
    `-DoutputFile=${outputFile}`,
    `-DworkspaceRoot=${workspaceRoot}`,
    '--batch-mode',
    '--no-transfer-progress'
  ];

  if (!isVerbose) {
    mavenArgs.push('-q');
  }

  console.log(`[Maven Analyzer] Maven command: ${mavenExecutable} ${mavenArgs.join(' ')}`);
  console.log(`[Maven Analyzer] Working directory: ${workspaceRoot}`);

  // Debug logging for verbose mode
  if (isVerbose) {
    console.error(`Running Maven analyzer with verbose logging: ${mavenExecutable} ${mavenArgs.join(' ')}`);
  }

  // Run Maven plugin
  console.log(`[Maven Analyzer] Spawning Maven process...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(mavenExecutable, mavenArgs, {
      cwd: workspaceRoot,
      stdio: 'pipe' // Always use pipe so we can control output
    });

    console.log(`[Maven Analyzer] Process spawned with PID: ${child.pid}`);

    let stdout = '';
    let stderr = '';

    // In verbose mode, forward output to console in real-time
    if (isVerbose) {
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        process.stdout.write(text); // Forward to stdout
      });
      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text); // Forward to stderr
      });
    } else {
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log(`[Maven Analyzer] Stdout chunk: ${text.trim()}`);
      });
      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        console.log(`[Maven Analyzer] Stderr chunk: ${text.trim()}`);
      });
    }

    child.on('close', (code) => {
      console.log(`[Maven Analyzer] Process closed with code: ${code}`);
      if (code === 0) {
        console.log(`[Maven Analyzer] Maven analysis completed successfully`);
        resolve();
      } else {
        let errorMsg = `Maven analysis failed with code ${code}`;
        if (stderr) errorMsg += `\nStderr: ${stderr}`;
        if (stdout && !isVerbose) errorMsg += `\nStdout: ${stdout}`;
        console.error(`[Maven Analyzer] Error: ${errorMsg}`);
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      console.error(`[Maven Analyzer] Process error: ${error.message}`);
      reject(new Error(`Failed to spawn Maven process: ${error.message}`));
    });
  });

  // Read and parse the JSON output
  console.log(`[Maven Analyzer] Checking for output file: ${outputFile}`);
  if (!existsSync(outputFile)) {
    console.error(`[Maven Analyzer] Output file not found: ${outputFile}`);
    throw new Error(`Maven analysis output file not found: ${outputFile}`);
  }

  console.log(`[Maven Analyzer] Reading output file...`);
  const jsonContent = readFileSync(outputFile, 'utf8');
  console.log(`[Maven Analyzer] Output file size: ${jsonContent.length} characters`);

  try {
    const result = JSON.parse(jsonContent) as MavenAnalysisData;
    console.log(`[Maven Analyzer] Successfully parsed analysis data with ${Object.keys(result).length} top-level keys`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Maven Analyzer] Failed to parse JSON: ${errorMessage}`);
    console.error(`[Maven Analyzer] JSON content preview: ${jsonContent.substring(0, 200)}...`);
    throw error;
  }
}


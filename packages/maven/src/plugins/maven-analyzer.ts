import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { logger, readJsonFile } from '@nx/devkit';
import { isCI } from 'nx/src/devkit-internals';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenAnalysisData, MavenPluginOptions } from './types';
import { detectMavenExecutable } from '../utils/detect-maven-executable';
import treeKill from 'tree-kill';

const DEFAULT_ANALYSIS_TIMEOUT_SECONDS = isCI() ? 600 : 120;

let currentAbortController: AbortController | undefined;

/**
 * Cancel any in-flight Maven analysis process.
 * Safe to call even if nothing is running.
 */
export function cancelPendingMavenAnalysis(): void {
  if (currentAbortController) {
    currentAbortController.abort('cancelled');
    currentAbortController = undefined;
  }
}

function getAnalysisTimeoutMs(): number {
  const envTimeout = process.env.NX_MAVEN_ANALYSIS_TIMEOUT;
  if (envTimeout) {
    const parsed = Number(envTimeout);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }
  return DEFAULT_ANALYSIS_TIMEOUT_SECONDS * 1000;
}

/**
 * Run Maven analysis using our Kotlin analyzer plugin
 */
export async function runMavenAnalysis(
  workspaceRoot: string,
  options: MavenPluginOptions
): Promise<MavenAnalysisData> {
  console.log(`[Maven Analyzer] Starting analysis with options:`, options);

  const outputFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const isVerbose =
    options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';

  logger.verbose(`[Maven Analyzer] Output file: ${outputFile}`);
  logger.verbose(`[Maven Analyzer] Verbose mode: ${isVerbose}`);
  logger.verbose(`[Maven Analyzer] Workspace root: ${workspaceRoot}`);
  logger.verbose(
    `[Maven Analyzer] Workspace data directory: ${workspaceDataDirectory}`
  );

  // Detect Maven executable (mvnd > mvnw > mvn)
  const mavenExecutable = detectMavenExecutable(workspaceRoot);

  const mavenArgs = [
    'dev.nx.maven:nx-maven-plugin:analyze',
    '-am',
    `-DoutputFile=${outputFile}`,
    `-DworkspaceRoot=${workspaceRoot}`,
    '--batch-mode',
    '--no-transfer-progress',
  ];

  if (options.targetNamePrefix) {
    mavenArgs.push(`-DtargetNamePrefix=${options.targetNamePrefix}`);
  }

  if (!isVerbose) {
    mavenArgs.push('-q');
  }

  logger.verbose(
    `[Maven Analyzer] Maven command: ${mavenExecutable} ${mavenArgs.join(' ')}`
  );
  logger.verbose(`[Maven Analyzer] Working directory: ${workspaceRoot}`);

  // Debug logging for verbose mode
  if (isVerbose) {
    console.error(
      `Running Maven analyzer with verbose logging: ${mavenExecutable} ${mavenArgs.join(
        ' '
      )}`
    );
  }

  // Cancel any in-flight Maven process from a previous call, then create a fresh controller.
  cancelPendingMavenAnalysis();
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  const timeoutMs = getAnalysisTimeoutMs();
  const timeoutSeconds = timeoutMs / 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Run Maven plugin
  logger.verbose(`[Maven Analyzer] Spawning Maven process...`);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(mavenExecutable, mavenArgs, {
        cwd: workspaceRoot,
        windowsHide: true,
        shell: true,
        stdio: 'pipe', // Always use pipe so we can control output
      });

      // Use tree-kill on abort to kill the entire process tree
      const onAbort = () => {
        if (child.pid) {
          treeKill(child.pid);
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });

      logger.verbose(`[Maven Analyzer] Process spawned with PID: ${child.pid}`);

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
          logger.verbose(`[Maven Analyzer] Stdout chunk: ${text.trim()}`);
        });
        child.stderr?.on('data', (data) => {
          const text = data.toString();
          stderr += text;
          logger.verbose(`[Maven Analyzer] Stderr chunk: ${text.trim()}`);
        });
      }

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort);
        logger.verbose(`[Maven Analyzer] Process closed with code: ${code}`);
        if (code === 0) {
          logger.verbose(
            `[Maven Analyzer] Maven analysis completed successfully`
          );
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
        signal.removeEventListener('abort', onAbort);
        console.error(`[Maven Analyzer] Process error: ${error.message}`);
        reject(new Error(`Failed to spawn Maven process: ${error.message}`));
      });
    });
  } catch (e: any) {
    if (signal.reason === 'cancelled') {
      throw new Error('Maven analysis was cancelled');
    }
    if (signal.aborted) {
      throw new Error(
        `Maven analysis timed out after ${timeoutSeconds} ${timeoutSeconds === 1 ? 'second' : 'seconds'}.\n` +
          `  1. If the issue persists, set the environment variable NX_MAVEN_ANALYSIS_TIMEOUT to a higher value (in seconds) to increase the timeout.\n` +
          `  2. If the issue still persists, set NX_MAVEN_DISABLE=true to disable the Maven plugin entirely.`
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  // Read and parse the JSON output
  logger.verbose(`[Maven Analyzer] Checking for output file: ${outputFile}`);
  if (!existsSync(outputFile)) {
    console.error(`[Maven Analyzer] Output file not found: ${outputFile}`);
    throw new Error(`Maven analysis output file not found: ${outputFile}`);
  }
  const result = readJsonFile(outputFile);
  logger.verbose(
    `[Maven Analyzer] Output file size: ${result.length} characters`
  );
  return result;
}

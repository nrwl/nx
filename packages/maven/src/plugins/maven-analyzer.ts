import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { logger, readJsonFile } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenAnalysisData, MavenPluginOptions } from './types';
import { detectMavenExecutable } from '../utils/detect-maven-executable';

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

  // Run Maven plugin
  logger.verbose(`[Maven Analyzer] Spawning Maven process...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(mavenExecutable, mavenArgs, {
      cwd: workspaceRoot,
      windowsHide: true,
      shell: true,
      stdio: 'pipe', // Always use pipe so we can control output
    });

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
      console.error(`[Maven Analyzer] Process error: ${error.message}`);
      reject(new Error(`Failed to spawn Maven process: ${error.message}`));
    });
  });

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

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { workspaceRoot } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenPluginOptions, MavenAnalysisData } from './types';
/**
 * Detect Maven wrapper in workspace root, fallback to 'mvn'
 */
function detectMavenWrapper(): string {
  if (process.platform === 'win32') {
    return existsSync(join(workspaceRoot, 'mvnw.cmd')) ? 'mvnw.cmd' : 'mvn';
  } else {
    return existsSync(join(workspaceRoot, 'mvnw')) ? './mvnw' : 'mvn';
  }
}

/**
 * Run Maven analysis using our Kotlin analyzer plugin
 */
export async function runMavenAnalysis(options: MavenPluginOptions): Promise<MavenAnalysisData> {
  const outputFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const isVerbose = options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';

  // Detect Maven wrapper or fallback to 'mvn'
  const mavenExecutable = detectMavenWrapper();
  
  const mavenArgs = [
    'dev.nx.maven:nx-maven-analyzer-plugin:1.0-SNAPSHOT:analyze',
    `-Dnx.outputFile=${outputFile}`,
    '--batch-mode',
    '--no-transfer-progress'
  ];

  if (!isVerbose) {
    mavenArgs.push('-q');
  }

  // Debug logging for verbose mode
  if (isVerbose) {
    console.error(`Running Maven analyzer with verbose logging: ${mavenExecutable} ${mavenArgs.join(' ')}`);
  }

  // Run Maven plugin
  await new Promise<void>((resolve, reject) => {
    const child = spawn(mavenExecutable, mavenArgs, {
      cwd: workspaceRoot,
      stdio: 'pipe' // Always use pipe so we can control output
    });

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
        stdout += data.toString();
      });
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        let errorMsg = `Maven analysis failed with code ${code}`;
        if (stderr) errorMsg += `\nStderr: ${stderr}`;
        if (stdout && !isVerbose) errorMsg += `\nStdout: ${stdout}`;
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn Maven process: ${error.message}`));
    });
  });

  // Read and parse the JSON output
  if (!existsSync(outputFile)) {
    throw new Error(`Maven analysis output file not found: ${outputFile}`);
  }

  const jsonContent = readFileSync(outputFile, 'utf8');
  return JSON.parse(jsonContent) as MavenAnalysisData;
}
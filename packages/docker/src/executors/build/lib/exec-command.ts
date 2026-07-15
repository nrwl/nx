import { spawn } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Capture output without streaming it to the parent process's stdio. */
  silent?: boolean;
}

/**
 * Runs a CLI command, always capturing stdout/stderr, and — unless `silent` — also streaming
 * them to the parent process's stdio so long-running commands (e.g. `docker buildx build`) show
 * live output. Used both for the actual build invocation and for short version-probe commands.
 */
export function execCommand(
  command: string,
  args: string[] = [],
  options: ExecCommandOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      stdio: [options.silent ? 'ignore' : 'inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!options.silent) {
        process.stdout.write(chunk);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (!options.silent) {
        process.stderr.write(chunk);
      }
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({ stdout, stderr, exitCode: code ?? (signal ? 1 : 0) });
    });
  });
}

import { spawn } from 'node:child_process';

export async function execCommand(
  cmd: string,
  args: string[],
  options?: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      encoding: 'utf-8',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          stderr ||
            `Unknown error occurred while running "${cmd} ${args.join(' ')}"`
        );
      } else {
        resolve(stdout);
      }
    });
  });
}

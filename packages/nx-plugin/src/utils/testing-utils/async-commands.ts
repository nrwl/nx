import { exec } from 'child_process';
import { tmpProjPath } from './paths';

/**
 * Run a command asynchronously inside the e2e directory.
 *
 * @param command
 * @param opts
 */
export function runCommandAsync(
  command: string,
  opts = {
    silenceError: false,
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: tmpProjPath(),
      },
      (err, stdout, stderr) => {
        if (!opts.silenceError && err) {
          reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

/**
 * Run a nx command asynchronously inside the e2e directory
 * @param command
 * @param opts
 */
export function runNxCommandAsync(
  command: string,
  opts = {
    silenceError: false,
  }
): Promise<{ stdout: string; stderr: string }> {
  return runCommandAsync(
    `node ./node_modules/@nrwl/cli/bin/nx.js ${command}`,
    opts
  );
}

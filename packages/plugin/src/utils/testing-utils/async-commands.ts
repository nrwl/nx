import { exec } from 'child_process';
import { tmpProjPath } from './paths';
import { getPackageManagerCommand } from '@nx/devkit';
import { fileExists } from './utils';

/**
 * Run a command asynchronously inside the e2e directory.
 *
 * @param command
 * @param opts
 */
export function runCommandAsync(
  command: string,
  opts: { silenceError?: boolean; env?: NodeJS.ProcessEnv; cwd?: string } = {
    silenceError: false,
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: opts.cwd ?? tmpProjPath(),
        env: { ...process.env, ...opts.env },
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
  opts: { silenceError?: boolean; env?: NodeJS.ProcessEnv; cwd?: string } = {
    silenceError: false,
  }
): Promise<{ stdout: string; stderr: string }> {
  if (fileExists(tmpProjPath('package.json'))) {
    const pmc = getPackageManagerCommand();
    return runCommandAsync(`${pmc.exec} nx ${command}`, opts);
  } else if (process.platform === 'win32') {
    return runCommandAsync(`./nx.bat %${command}`, opts);
  } else {
    return runCommandAsync(`./nx %${command}`, opts);
  }
}

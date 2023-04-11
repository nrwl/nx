import { exec, execSync } from 'child_process';
import { dirname } from 'path';
import { tmpProjPath } from './paths';
import { getPackageManagerCommand } from '@nrwl/devkit';
import { fileExists } from './utils';

/**
 * Run a command asynchronously inside the e2e directory.
 *
 * @param command
 * @param opts
 */
export function runCommandAsync(
  command: string,
  opts: { silenceError?: boolean; env?: NodeJS.ProcessEnv } = {
    silenceError: false,
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: tmpProjPath(),
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
  opts: { silenceError?: boolean; env?: NodeJS.ProcessEnv } = {
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

export function runNxNewCommand(args?: string, silent?: boolean) {
  const localTmpDir = dirname(tmpProjPath());
  return execSync(
    `node ${require.resolve(
      'nx'
    )} new proj --nx-workspace-root=${localTmpDir} --no-interactive --skip-install --collection=@nrwl/workspace --npmScope=proj --preset=empty ${
      args || ''
    }`,
    {
      cwd: localTmpDir,
      ...(silent && false ? { stdio: ['ignore', 'ignore', 'ignore'] } : {}),
    }
  );
}

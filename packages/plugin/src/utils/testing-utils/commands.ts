import { ExecOptions, execSync } from 'child_process';
import { tmpProjPath } from './paths';
import { getPackageManagerCommand } from '@nx/devkit';
import { fileExists } from './utils';

/**
 * Run a nx command inside the e2e directory
 * @param command
 * @param opts
 *
 * @see tmpProjPath
 */
export function runNxCommand(
  command?: string,
  opts: { silenceError?: boolean; env?: NodeJS.ProcessEnv; cwd?: string } = {
    silenceError: false,
  }
): string {
  function _runNxCommand(c) {
    const execSyncOptions: ExecOptions = {
      cwd: opts.cwd ?? tmpProjPath(),
      env: { ...process.env, ...opts.env },
    };
    if (fileExists(tmpProjPath('package.json'))) {
      const pmc = getPackageManagerCommand();
      return execSync(`${pmc.exec} nx ${command}`, execSyncOptions);
    } else if (process.platform === 'win32') {
      return execSync(`./nx.bat %${command}`, execSyncOptions);
    } else {
      return execSync(`./nx %${command}`, execSyncOptions);
    }
  }

  try {
    return _runNxCommand(command)
      .toString()
      .replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
      );
  } catch (e) {
    if (opts.silenceError) {
      return e.stdout.toString();
    } else {
      console.log(e.stdout.toString(), e.stderr.toString());
      throw e;
    }
  }
}

export function runCommand(
  command: string,
  opts: { env?: NodeJS.ProcessEnv; cwd?: string }
): string {
  try {
    return execSync(command, {
      cwd: opts.cwd ?? tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...opts?.env },
    }).toString();
  } catch (e) {
    return e.stdout.toString() + e.stderr.toString();
  }
}

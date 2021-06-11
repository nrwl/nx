import { execSync } from 'child_process';
import { tmpProjPath } from './paths';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';

/**
 * Run a nx command inside the e2e directory
 * @param command
 * @param opts
 *
 * @see tmpProjPath
 */
export function runNxCommand(
  command?: string,
  opts = {
    silenceError: false,
  }
): string {
  try {
    const pmc = getPackageManagerCommand();
    return execSync(`${pmc.exec} nx ${command}`, {
      cwd: tmpProjPath(),
    })
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

export function runCommand(command: string): string {
  try {
    return execSync(command, {
      cwd: tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
  } catch (e) {
    return e.stdout.toString() + e.stderr.toString();
  }
}

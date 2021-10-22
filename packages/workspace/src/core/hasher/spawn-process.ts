import { spawnSync } from 'child_process';

// We can't use an import for this package because of how it is published
const stripAnsi = require('strip-ansi');

/**
 * We separated this out into its own file to make it much easier to unit test
 * and ensure that ANSI escape codes are appropriately stripped so that utilities
 * in git-hasher work as intended in all cases.
 */
export function spawnProcess(
  command: string,
  args: string[],
  cwd: string
): string {
  const r = spawnSync(command, args, {
    cwd,
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  if (r.status !== 0) {
    throw new Error(
      `Failed to run ${command} ${args.join(' ')}.\n${r.stdout}\n${r.stderr}`
    );
  }
  const output = r.stdout.toString().trimEnd();

  // We use strip-ansi to prevent issues such as https://github.com/nrwl/nx/issues/7022
  return stripAnsi(output);
}

import { spawnSync } from 'child_process';
import { executeNxCloudCommand, isConnectedToNxCloud } from '../utils';
import { output } from '../../../utils/output';

export interface RecordArgs {
  verbose?: boolean;
  '--'?: string[];
}

export function recordHandler(args: RecordArgs): Promise<number> {
  if (!isConnectedToNxCloud()) {
    let exitCode: number = 0;
    const commandArgs = args['--'];
    if (commandArgs && commandArgs.length > 0) {
      const [cmd, ...cmdArgs] = commandArgs;
      const result = spawnSync(cmd, cmdArgs, {
        stdio: 'inherit',
        shell: true,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        windowsHide: true,
      });
      exitCode = result.status ?? 1;
    }
    output.warn({
      title: 'Nx Cloud is not enabled',
      bodyLines: [
        'To record command using Nx Cloud, connect your workspace with `nx connect`.',
      ],
    });
    return Promise.resolve(exitCode);
  }
  return executeNxCloudCommand('record', args.verbose);
}

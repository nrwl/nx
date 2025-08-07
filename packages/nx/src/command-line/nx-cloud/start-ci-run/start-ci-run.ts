import { executeNxCloudCommand } from '../utils';

export interface StartCiRunArgs {
  verbose?: boolean;
}

export function startCiRunHandler(args: StartCiRunArgs): Promise<number> {
  return executeNxCloudCommand('start-ci-run', args.verbose);
}
